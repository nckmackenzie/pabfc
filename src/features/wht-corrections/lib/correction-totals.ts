import { roundDecimal, toNumber } from "@/lib/helpers";

export function sumCorrectionLines(
	lines: Array<{ amount: number }>,
): number {
	return roundDecimal(
		lines.reduce((total, line) => total + toNumber(line.amount), 0),
	);
}

type BuildCorrectionJournalLinesParams = {
	treatmentAccountId: number;
	creditAccountId: number;
	total: number;
	memo?: string | null;
};

/**
 * Every correction posts exactly two lines: DR the treatment account the
 * user chose, CR whichever account was resolved for the scenario (a bank/
 * cash-equivalent account for `already_remitted`, `wht_payable` for
 * `pending`). Both sides always carry the same total, so this can never
 * produce an unbalanced entry.
 */
export function buildCorrectionJournalLines({
	treatmentAccountId,
	creditAccountId,
	total,
	memo,
}: BuildCorrectionJournalLinesParams) {
	return [
		{
			accountId: treatmentAccountId,
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
