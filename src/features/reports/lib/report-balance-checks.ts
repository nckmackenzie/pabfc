import { toBig, toDecimalString } from "@/lib/helpers";

/**
 * A trial balance is balanced when total debit balances equal total credit
 * balances across all reported accounts. Amounts are rounded to 2 decimals
 * before comparison to absorb floating-point noise.
 */
export function isTrialBalanced(
	rows: Array<{ debit_balance: string; credit_balance: string }>
): boolean {
	const totalDebits = rows.reduce((sum, row) => sum.plus(toBig(row.debit_balance)), toBig(0));
	const totalCredits = rows.reduce((sum, row) => sum.plus(toBig(row.credit_balance)), toBig(0));
	return toDecimalString(totalDebits) === toDecimalString(totalCredits);
}

/**
 * A balance sheet is balanced when Assets = Liabilities + Equity. Equity here
 * includes any computed rows such as current-year earnings.
 */
export function isBalanceSheetBalanced(
	rows: Array<{ type: "asset" | "liability" | "equity"; total: string }>
): boolean {
	const totalAssets = rows
		.filter((row) => row.type === "asset")
		.reduce((sum, row) => sum.plus(toBig(row.total)), toBig(0));
	const totalLiabilitiesAndEquity = rows
		.filter((row) => row.type === "liability" || row.type === "equity")
		.reduce((sum, row) => sum.plus(toBig(row.total)), toBig(0));
	return toDecimalString(totalAssets) === toDecimalString(totalLiabilitiesAndEquity);
}
