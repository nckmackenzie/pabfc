import { whtAmountForLine, type WhtLineInput } from "@/features/bills/lib/wht";
import type { VatType } from "@/drizzle/schema";
import { roundDecimal, taxCalculator, toNumber } from "@/lib/helpers";
import type { NumericValue } from "@/lib/helpers";

export type BillLineInput = WhtLineInput & {
	amount: NumericValue;
	vatType?: VatType | null;
};

export type BillLineAmounts = {
	/** Value of the line excluding VAT. The base for both VAT and WHT. */
	subTotal: number;
	taxAmount: number;
	/** Value of the line including VAT. */
	total: number;
	whtAmount: number;
};

export type BillTotals = BillLineAmounts & {
	/** What the vendor is owed: `total` less the tax withheld on their behalf. */
	netPayable: number;
};

/**
 * Every monetary figure a single bill line produces, rounded to the 2dp that is
 * actually persisted.
 *
 * This is the one place the figures are derived. `upsertBill` uses it to build the
 * rows it stores and the journal it posts; the bill form uses it to show the user
 * the same numbers before submitting. Keeping both on this function is what stops
 * the previewed totals and the posted totals from drifting apart.
 */
export function billLineAmounts(line: BillLineInput): BillLineAmounts {
	const { taxAmount, amountExlusiveTax, totalInclusiveTax } = taxCalculator(
		toNumber(line.amount),
		line.vatType ?? "none",
	);

	return {
		subTotal: roundDecimal(amountExlusiveTax),
		taxAmount: roundDecimal(taxAmount),
		total: roundDecimal(totalInclusiveTax),
		whtAmount: whtAmountForLine(line, amountExlusiveTax),
	};
}

/**
 * Bill totals, summed from the already-rounded line figures so that the stored
 * totals equal the sum of the stored lines to the cent. That exactness is what
 * lets the journal's credit side split into `netPayable` + `whtAmount` and still
 * balance against the debits.
 */
export function sumBillLineAmounts(lines: Array<BillLineAmounts>): BillTotals {
	const totals = lines.reduce<BillLineAmounts>(
		(acc, line) => ({
			subTotal: roundDecimal(acc.subTotal + line.subTotal),
			taxAmount: roundDecimal(acc.taxAmount + line.taxAmount),
			total: roundDecimal(acc.total + line.total),
			whtAmount: roundDecimal(acc.whtAmount + line.whtAmount),
		}),
		{ subTotal: 0, taxAmount: 0, total: 0, whtAmount: 0 },
	);

	return {
		...totals,
		netPayable: roundDecimal(totals.total - totals.whtAmount),
	};
}

/** Convenience for callers holding raw form/request lines rather than amounts. */
export function billTotals(lines: Array<BillLineInput>): BillTotals {
	return sumBillLineAmounts(lines.map(billLineAmounts));
}
