import { describe, expect, it } from "vitest";
import Big from "big.js";
import {
	computeCreditVatSplit,
	computeMembershipTaxRatio,
	computeSuggestedCreditAmount,
} from "./eligibility";

describe("computeSuggestedCreditAmount", () => {
	it("computes dailyRate and suggestedAmount for a partial month", () => {
		const result = computeSuggestedCreditAmount({
			priceCharged: "3000.00",
			planDurationDays: 30,
			unusedDays: 10,
		});
		expect(result.dailyRate).toBe("100.00");
		expect(result.suggestedAmount).toBe("1000.00");
	});

	it("caps the suggested amount at priceCharged even if unusedDays exceeds the plan duration", () => {
		const result = computeSuggestedCreditAmount({
			priceCharged: "3000.00",
			planDurationDays: 30,
			unusedDays: 45,
		});
		expect(result.suggestedAmount).toBe("3000.00");
	});

	it("rounds the daily rate to 2 decimals without losing precision on the suggested amount", () => {
		// 1000 / 3 = 333.33... — dailyRate is rounded for display, but suggestedAmount
		// uses the unrounded rate internally so 3 days doesn't undershoot 1000.00.
		const result = computeSuggestedCreditAmount({
			priceCharged: "1000.00",
			planDurationDays: 3,
			unusedDays: 3,
		});
		expect(result.dailyRate).toBe("333.33");
		expect(result.suggestedAmount).toBe("1000.00");
	});
});

describe("computeMembershipTaxRatio", () => {
	it("computes the ratio from lineTotal + taxAmount, ignoring any addon amount folded into totalAmount", () => {
		// A payment with lineTotal 1000, taxAmount 160 (16%), plus a VAT-exempt addon
		// subtotal of 500 folded into totalAmount (1660) — the ratio must stay 0.16,
		// not be diluted to 160/1660 by the addon portion.
		const ratio = computeMembershipTaxRatio("1000.00", "160.00");
		expect(ratio.toFixed(4)).toBe(new Big("160").div("1160").toFixed(4));
		expect(ratio.toFixed(4)).not.toBe(new Big("160").div("1660").toFixed(4));
	});

	it("returns zero when the membership portion had no tax", () => {
		expect(computeMembershipTaxRatio("1000.00", "0.00").toNumber()).toBe(0);
	});

	it("returns zero rather than dividing by zero when lineTotal and taxAmount are both zero", () => {
		expect(computeMembershipTaxRatio("0.00", "0.00").toNumber()).toBe(0);
	});
});

describe("computeCreditVatSplit", () => {
	it("splits proportionally using the original payment's tax ratio", () => {
		// Ratio 0.16 (e.g. taxAmount 160 / totalAmount 1000 on the original payment).
		const taxRatio = new Big("160").div("1000");
		const result = computeCreditVatSplit("500.00", taxRatio);
		expect(result.creditTax).toBe("80.00");
		expect(result.creditSubtotal).toBe("420.00");
	});

	it("returns a zero VAT split when the original payment had no tax", () => {
		const result = computeCreditVatSplit("500.00", new Big(0));
		expect(result.creditTax).toBe("0.00");
		expect(result.creditSubtotal).toBe("500.00");
	});

	it("creditSubtotal + creditTax always reconciles back to the input amount", () => {
		const taxRatio = new Big("1").div("3");
		const result = computeCreditVatSplit("100.00", taxRatio);
		expect(new Big(result.creditSubtotal).plus(result.creditTax).toFixed(2)).toBe("100.00");
	});
});
