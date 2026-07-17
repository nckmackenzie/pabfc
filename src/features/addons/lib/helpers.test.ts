import { describe, expect, it } from "vitest";
import { buildReceiptJournalLines } from "@/features/receipts/lib/journal";
import { areJournalValuesBalanced } from "@/services/journal";
import {
	buildAddonInvoiceLines,
	combineAddonRevenueLines,
	computeAddonLineSubtotal,
	type PriceableAddon,
	resolveAddonDeleteStrategy,
	sumAddonSubtotal,
} from "./helpers";

const lockerHire: PriceableAddon = {
	id: "addon_locker",
	name: "Locker Hire",
	amount: "500.00",
	perMember: false,
	revenueAccountId: 40,
};

const towelPerMember: PriceableAddon = {
	id: "addon_towel",
	name: "Towel Service",
	amount: "200.00",
	perMember: true,
	revenueAccountId: 41,
};

describe("computeAddonLineSubtotal", () => {
	it("does not multiply by member count when perMember is false", () => {
		// 500 × 3 periods × (members ignored) = 1500
		expect(computeAddonLineSubtotal("500.00", 3, 5, false)).toBe("1500.00");
	});

	it("multiplies by member count when perMember is true", () => {
		// 200 × 2 periods × 4 members = 1600
		expect(computeAddonLineSubtotal("200.00", 2, 4, true)).toBe("1600.00");
	});

	it("a perMember addon with 2 members is double the same addon as non-perMember", () => {
		const perMember = computeAddonLineSubtotal("200.00", 1, 2, true);
		const flat = computeAddonLineSubtotal("200.00", 1, 2, false);
		expect(Number(perMember)).toBe(Number(flat) * 2);
	});
});

describe("buildAddonInvoiceLines", () => {
	it("snapshots addon fields and prices each line VAT-exempt", () => {
		const [line] = buildAddonInvoiceLines([lockerHire], {
			numberOfPeriods: 2,
			numberOfMembers: 3,
		});
		expect(line).toMatchObject({
			addonId: "addon_locker",
			addonName: "Locker Hire",
			unitAmount: "500.00",
			perMember: false,
			revenueAccountId: 40,
			numberOfPeriods: 2,
			numberOfMembers: 3,
			lineSubtotal: "1000.00",
			taxAmount: "0.00",
			lineTotal: "1000.00",
		});
	});

	it("prices a perMember line by the covered member count", () => {
		const [line] = buildAddonInvoiceLines([towelPerMember], {
			numberOfPeriods: 1,
			numberOfMembers: 4,
		});
		expect(line.lineSubtotal).toBe("800.00");
		expect(line.lineTotal).toBe("800.00");
		// VAT-exempt: never any tax
		expect(line.taxAmount).toBe("0.00");
	});
});

describe("sumAddonSubtotal", () => {
	it("sums line subtotals", () => {
		const lines = buildAddonInvoiceLines([lockerHire, towelPerMember], {
			numberOfPeriods: 1,
			numberOfMembers: 2,
		});
		// 500 (flat) + 200×2 (per member) = 900
		expect(sumAddonSubtotal(lines)).toBe("900.00");
	});
});

describe("combineAddonRevenueLines", () => {
	it("produces one credit line per unique revenue account", () => {
		const lines = buildAddonInvoiceLines([lockerHire, towelPerMember], {
			numberOfPeriods: 1,
			numberOfMembers: 1,
		});
		const combined = combineAddonRevenueLines(lines);
		expect(combined).toHaveLength(2);
	});

	it("combines two addons that share a revenue account into a single line", () => {
		const sharedA: PriceableAddon = { ...lockerHire, id: "a", revenueAccountId: 40 };
		const sharedB: PriceableAddon = {
			...lockerHire,
			id: "b",
			amount: "250.00",
			revenueAccountId: 40,
		};
		const lines = buildAddonInvoiceLines([sharedA, sharedB], {
			numberOfPeriods: 1,
			numberOfMembers: 1,
		});
		const combined = combineAddonRevenueLines(lines);
		expect(combined).toHaveLength(1);
		expect(combined[0]).toEqual({ accountId: 40, amount: "750.00" });
	});
});

describe("buildReceiptJournalLines (production journal builder)", () => {
	it("balances membership revenue + VAT + combined addon credits against the bank debit", () => {
		const addonLines = buildAddonInvoiceLines([lockerHire, towelPerMember], {
			numberOfPeriods: 1,
			numberOfMembers: 2,
		});
		const addonSubtotal = Number(sumAddonSubtotal(addonLines)); // 900

		// Membership portion: 10,000 revenue + 1,600 VAT = 11,600 gross.
		const membershipRevenue = 10000;
		const vat = 1600;
		const bankTotal = membershipRevenue + vat + addonSubtotal;

		const lines = buildReceiptJournalLines({
			membershipRevenue: { accountId: 1, amount: membershipRevenue.toFixed(2) },
			vat: { accountId: 2, amount: vat.toFixed(2) },
			addonLines,
			bankAccountId: 99,
			bankAmount: bankTotal.toFixed(2),
			memo: "",
		});

		// 2 addon revenue accounts + membership + VAT + bank debit = 5 lines.
		expect(lines).toHaveLength(5);
		// Bank debit is always last.
		expect(lines.at(-1)).toMatchObject({ accountId: 99, dc: "debit" });
		expect(lines.filter((line) => line.dc === "credit")).toHaveLength(4);
		expect(areJournalValuesBalanced(lines)).toBe(true);
	});

	it("combines addons sharing a revenue account into a single credit line", () => {
		const sharedA: PriceableAddon = { ...lockerHire, id: "a", revenueAccountId: 40 };
		const sharedB: PriceableAddon = { ...lockerHire, id: "b", revenueAccountId: 40 };
		const addonLines = buildAddonInvoiceLines([sharedA, sharedB], {
			numberOfPeriods: 1,
			numberOfMembers: 1,
		});
		const lines = buildReceiptJournalLines({
			membershipRevenue: { accountId: 1, amount: "1000.00" },
			addonLines,
			bankAccountId: 99,
			bankAmount: "2000.00",
			memo: "",
		});
		// membership + one combined addon credit + bank debit = 3 lines.
		expect(lines).toHaveLength(3);
		expect(areJournalValuesBalanced(lines)).toBe(true);
	});

	it("addon-only receipt posts no membership revenue or VAT line and stays balanced", () => {
		const addonLines = buildAddonInvoiceLines([lockerHire, towelPerMember], {
			numberOfPeriods: 1,
			numberOfMembers: 2,
		});
		const addonSubtotal = sumAddonSubtotal(addonLines);
		const membershipRevenueAccount = 1;
		const vatAccount = 2;

		const lines = buildReceiptJournalLines({
			addonLines,
			bankAccountId: 99,
			bankAmount: addonSubtotal,
			memo: "",
		});

		// Only the two addon credits + bank debit — no membership/VAT accounts.
		expect(lines).toHaveLength(3);
		expect(
			lines.some((line) => line.accountId === membershipRevenueAccount),
		).toBe(false);
		expect(lines.some((line) => line.accountId === vatAccount)).toBe(false);
		expect(areJournalValuesBalanced(lines)).toBe(true);
	});
});

describe("resolveAddonDeleteStrategy", () => {
	it("soft-deletes when invoice lines reference the addon", () => {
		expect(resolveAddonDeleteStrategy(true)).toBe("soft");
	});

	it("hard-deletes when no invoice lines exist", () => {
		expect(resolveAddonDeleteStrategy(false)).toBe("hard");
	});
});
