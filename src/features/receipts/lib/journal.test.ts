import { describe, expect, it } from "vitest";
import { buildReceiptJournalLines } from "./journal";

describe("buildReceiptJournalLines", () => {
	it("builds membershipRevenue + vat + bank lines unchanged from the pre-credit-note shape", () => {
		const lines = buildReceiptJournalLines({
			membershipRevenue: { accountId: 1, amount: "1000.00" },
			vat: { accountId: 2, amount: "160.00" },
			bankAccountId: 3,
			bankAmount: "1160.00",
			memo: "test",
		});
		expect(lines).toEqual([
			{ lineNumber: 1, accountId: 1, amount: "1000.00", dc: "credit", memo: "test" },
			{ lineNumber: 2, accountId: 2, amount: "160.00", dc: "credit", memo: "test" },
			{ lineNumber: 3, accountId: 3, amount: "1160.00", dc: "debit", memo: "test" },
		]);
	});

	it("adds an addon-only revenue credit line with no membershipRevenue/vat", () => {
		const lines = buildReceiptJournalLines({
			addonLines: [{ revenueAccountId: 5, lineSubtotal: "200.00" }],
			bankAccountId: 3,
			bankAmount: "200.00",
			memo: "addon",
		});
		expect(lines).toEqual([
			{ lineNumber: 1, accountId: 5, amount: "200.00", dc: "credit", memo: "addon" },
			{ lineNumber: 2, accountId: 3, amount: "200.00", dc: "debit", memo: "addon" },
		]);
	});

	it("adds a creditApplied debit line before the bank line when a partial credit is applied", () => {
		const lines = buildReceiptJournalLines({
			membershipRevenue: { accountId: 1, amount: "1000.00" },
			creditApplied: { accountId: 9, amount: "400.00" },
			bankAccountId: 3,
			bankAmount: "600.00",
			memo: "test",
		});
		expect(lines).toEqual([
			{ lineNumber: 1, accountId: 1, amount: "1000.00", dc: "credit", memo: "test" },
			{ lineNumber: 2, accountId: 9, amount: "400.00", dc: "debit", memo: "test" },
			{ lineNumber: 3, accountId: 3, amount: "600.00", dc: "debit", memo: "test" },
		]);
	});

	it("omits the bank line entirely when the receipt is fully funded by credit", () => {
		const lines = buildReceiptJournalLines({
			membershipRevenue: { accountId: 1, amount: "1000.00" },
			creditApplied: { accountId: 9, amount: "1000.00" },
			memo: "test",
		});
		expect(lines).toEqual([
			{ lineNumber: 1, accountId: 1, amount: "1000.00", dc: "credit", memo: "test" },
			{ lineNumber: 2, accountId: 9, amount: "1000.00", dc: "debit", memo: "test" },
		]);
	});

	it("still balances (debit total === credit total) with a credit-applied line present", () => {
		const lines = buildReceiptJournalLines({
			membershipRevenue: { accountId: 1, amount: "1000.00" },
			vat: { accountId: 2, amount: "160.00" },
			creditApplied: { accountId: 9, amount: "500.00" },
			bankAccountId: 3,
			bankAmount: "660.00",
			memo: "test",
		});
		const creditTotal = lines
			.filter((l) => l.dc === "credit")
			.reduce((s, l) => s + Number(l.amount), 0);
		const debitTotal = lines
			.filter((l) => l.dc === "debit")
			.reduce((s, l) => s + Number(l.amount), 0);
		expect(debitTotal).toBe(creditTotal);
	});
});
