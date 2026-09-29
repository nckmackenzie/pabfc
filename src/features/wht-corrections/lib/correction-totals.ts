import { roundDecimal, toNumber } from "@/lib/helpers";

export function sumCorrectionLines(
	lines: Array<{ amount: number }>,
): number {
	return roundDecimal(
		lines.reduce((total, line) => total + toNumber(line.amount), 0),
	);
}

type BuildCorrectionJournalLinesParams = {
	debitAccountId: number;
	creditAccountId: number;
	total: number;
	memo?: string | null;
};

/**
 * Every correction posts exactly two lines: DR accounts_payable (the
 * original bill posted CR accounts_payable for the full pre-correction
 * amount, so the correction always brings that recorded payable back down
 * to what's actually owed), CR whichever account was resolved for the
 * scenario (a bank/cash-equivalent account for `already_remitted`,
 * `wht_payable` for `pending`). Both sides always carry the same total, so
 * this can never produce an unbalanced entry.
 */
export function buildCorrectionJournalLines({
	debitAccountId,
	creditAccountId,
	total,
	memo,
}: BuildCorrectionJournalLinesParams) {
	return [
		{
			accountId: debitAccountId,
			amount: total.toString(),
			dc: "debit" as const,
			lineNumber: 1,
			memo,
		},
		{
			accountId: creditAccountId,
			amount: total.toString(),
			dc: "credit" as const,
			lineNumber: 2,
			memo,
		},
	];
}
