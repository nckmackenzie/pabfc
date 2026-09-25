import type Big from "big.js";
import type { NumericValue } from "@/lib/helpers";
import { roundDecimal, toBig, toNumber } from "@/lib/helpers";

export type WhtLineInput = {
	whtApplicable?: boolean | null;
	whtRate?: NumericValue;
};

/**
 * Withholding tax for a single bill line.
 *
 * The base is the VAT-exclusive value of the line: WHT is withheld on the
 * consideration for the supply, not on the VAT charged on it. Callers pass the
 * `amountExlusiveTax` that `taxCalculator` already derived, so VAT-inclusive and
 * VAT-exclusive lines share one base.
 *
 * Returns a value rounded to 2dp so that the sum of the lines equals the bill's
 * stored `whtAmount` exactly, and the journal's credit split stays balanced.
 */
export function whtAmountForLine(
	line: WhtLineInput,
	amountExclusiveTax: NumericValue,
): number {
	if (!line.whtApplicable) return 0;

	const rate = toNumber(line.whtRate ?? 0);
	if (rate <= 0) return 0;

	const base = toBig(amountExclusiveTax);
	if (base.lte(0)) return 0;

	return roundDecimal(base.times(rate).div(100));
}

/**
 * Total withheld across a bill's lines. Each line is already rounded, so the sum
 * is exact and needs no second rounding pass.
 */
export function sumWhtAmounts(amounts: Array<NumericValue>): number {
	return roundDecimal(
		amounts.reduce<Big>((total, amount) => total.plus(toBig(amount)), toBig(0)),
	);
}

/**
 * What the vendor is actually owed on a bill: the gross total less the amount
 * withheld on the vendor's behalf. Every "amount owed to vendor" figure in the
 * app derives from this, including `vw_invoices.net_payable`.
 */
export function netPayable(total: NumericValue, whtAmount: NumericValue): number {
	return roundDecimal(toBig(total).minus(toBig(whtAmount)));
}
