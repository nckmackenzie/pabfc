import { describe, expect, it } from "vitest";
import {
	billLineAmounts,
	billTotals,
	type BillLineInput,
} from "@/features/bills/lib/bill-totals";

const withheldLine = (overrides: Partial<BillLineInput> = {}): BillLineInput => ({
	amount: 10_000,
	vatType: "exclusive",
	whtApplicable: true,
	whtRate: 5,
	...overrides,
});

describe("billLineAmounts", () => {
	it("derives VAT and WHT from a VAT-exclusive line", () => {
		expect(billLineAmounts(withheldLine())).toEqual({
			subTotal: 10_000,
			taxAmount: 1_600,
			total: 11_600,
			whtAmount: 500,
		});
	});

	it("derives VAT and WHT from a VAT-inclusive line", () => {
		expect(billLineAmounts(withheldLine({ amount: 11_600, vatType: "inclusive" }))).toEqual(
			{
				subTotal: 10_000,
				taxAmount: 1_600,
				total: 11_600,
				whtAmount: 500,
			},
		);
	});

	it("handles a line with no VAT", () => {
		expect(billLineAmounts(withheldLine({ vatType: "none" }))).toEqual({
			subTotal: 10_000,
			taxAmount: 0,
			total: 10_000,
			whtAmount: 500,
		});
	});

	it("withholds nothing when the line is not marked as withheld", () => {
		expect(billLineAmounts(withheldLine({ whtApplicable: false })).whtAmount).toBe(0);
	});

	it("treats a blank amount as zero rather than NaN", () => {
		expect(billLineAmounts(withheldLine({ amount: "" }))).toEqual({
			subTotal: 0,
			taxAmount: 0,
			total: 0,
			whtAmount: 0,
		});
	});
});

describe("billTotals", () => {
	it("sums mixed lines and nets the withheld tax off the total", () => {
		const totals = billTotals([
			withheldLine(),
			withheldLine({ amount: 5_000, whtRate: 3 }),
			withheldLine({ amount: 2_000, whtApplicable: false, vatType: "none" }),
		]);

		expect(totals).toEqual({
			subTotal: 17_000,
			taxAmount: 2_400,
			total: 19_400,
			whtAmount: 650,
			netPayable: 18_750,
		});
	});

	it("leaves the total untouched when nothing is withheld", () => {
		const totals = billTotals([withheldLine({ whtApplicable: false })]);
		expect(totals.whtAmount).toBe(0);
		expect(totals.netPayable).toBe(totals.total);
	});

	it("is all zeroes for a bill with no lines", () => {
		expect(billTotals([])).toEqual({
			subTotal: 0,
			taxAmount: 0,
			total: 0,
			whtAmount: 0,
			netPayable: 0,
		});
	});

	/**
	 * The journal credits `netPayable` to the vendor and `whtAmount` to KRA against
	 * a debit of `subTotal + taxAmount`. `areJournalValuesBalanced` compares those
	 * sides with exact float equality, so any rounding drift here would reject the
	 * posting outright.
	 */
	it("keeps the journal's two sides exactly equal on awkward amounts", () => {
		const totals = billTotals([
			withheldLine({ amount: 1_000.5, whtRate: 3 }),
			withheldLine({ amount: 333.33, vatType: "inclusive", whtRate: 5 }),
			withheldLine({ amount: 0.07, vatType: "none", whtRate: 10 }),
		]);

		expect(totals.subTotal + totals.taxAmount).toBe(
			totals.netPayable + totals.whtAmount,
		);
		expect(totals.netPayable + totals.whtAmount).toBe(totals.total);
	});
});
