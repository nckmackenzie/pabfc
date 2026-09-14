import type Big from "big.js";
import type { AccountType } from "@/drizzle/schema";
import { type NumericValue, toBig } from "@/lib/helpers";

export type NormalBalance = "debit" | "credit";

/**
 * How far back an account's opening balance reaches.
 *
 * - `full-history`: balance sheet accounts carry every posting before the
 *   report start, across fiscal years.
 * - `fiscal-year`: income statement accounts reset at the start of the fiscal
 *   year containing the report start, and again at every fiscal year start
 *   inside the report period.
 */
export type OpeningBalanceScope = "full-history" | "fiscal-year";

export type GeneralLedgerLine = {
	id: number;
	date: string;
	memo: string | null;
	description: string | null;
	source: string | null;
	reference: string | null;
	dc: NormalBalance;
	amount: string;
};

type GeneralLedgerRowBase = Omit<GeneralLedgerLine, "id" | "dc" | "amount"> & {
	debit: number;
	credit: number;
	runningBalance: number;
};

/**
 * A ledger row is either a posted journal line or a synthetic marker showing
 * where a fiscal-year-scoped balance resets to zero inside the period.
 */
export type GeneralLedgerRow =
	| (GeneralLedgerRowBase & { kind: "transaction"; id: number })
	| (GeneralLedgerRowBase & { kind: "year-reset"; id: null });

export type GeneralLedgerResult = {
	openingBalance: number;
	rows: GeneralLedgerRow[];
	totalDebits: number;
	totalCredits: number;
	closingBalance: number;
};

// The app does not post fiscal-year closing entries, so only nominal accounts
// may be bounded by the fiscal year start without understating their balance.
export function getOpeningBalanceScope(type: AccountType): OpeningBalanceScope {
	return type === "revenue" || type === "expense" ? "fiscal-year" : "full-history";
}

function netMovement(normalBalance: NormalBalance, debit: NumericValue, credit: NumericValue): Big {
	return normalBalance === "debit"
		? toBig(debit).minus(toBig(credit))
		: toBig(credit).minus(toBig(debit));
}

function yearResetRow(date: string): GeneralLedgerRow {
	return {
		kind: "year-reset",
		id: null,
		date,
		memo: null,
		description: null,
		source: null,
		reference: null,
		debit: 0,
		credit: 0,
		runningBalance: 0,
	};
}

/**
 * Walks ordered journal lines from the opening balance, producing a running
 * balance per row signed by the account's normal balance, plus period totals.
 *
 * `yearStartDates` are fiscal year starts inside the period (ISO dates). The
 * running balance resets to zero at each one and a `year-reset` row marks it.
 * Period totals still cover every line in the period.
 */
export function buildGeneralLedger({
	normalBalance,
	openingDebits,
	openingCredits,
	lines,
	yearStartDates = [],
}: {
	normalBalance: NormalBalance;
	openingDebits: NumericValue;
	openingCredits: NumericValue;
	lines: GeneralLedgerLine[];
	yearStartDates?: string[];
}): GeneralLedgerResult {
	const openingBalance = netMovement(normalBalance, openingDebits, openingCredits);
	const resetDates = [...yearStartDates].sort();
	let nextResetIndex = 0;
	let runningBalance = openingBalance;
	let totalDebits = toBig(0);
	let totalCredits = toBig(0);
	const rows: GeneralLedgerRow[] = [];

	// Emits reset rows for every boundary on or before `date` (all remaining when null).
	function applyResetsThrough(date: string | null) {
		while (
			nextResetIndex < resetDates.length &&
			(date === null || resetDates[nextResetIndex] <= date)
		) {
			runningBalance = toBig(0);
			rows.push(yearResetRow(resetDates[nextResetIndex]));
			nextResetIndex++;
		}
	}

	for (const { dc, amount, ...line } of lines) {
		applyResetsThrough(line.date);

		const debit = dc === "debit" ? toBig(amount) : toBig(0);
		const credit = dc === "credit" ? toBig(amount) : toBig(0);

		totalDebits = totalDebits.plus(debit);
		totalCredits = totalCredits.plus(credit);
		runningBalance = runningBalance.plus(netMovement(normalBalance, debit, credit));

		rows.push({
			...line,
			kind: "transaction",
			debit: debit.toNumber(),
			credit: credit.toNumber(),
			runningBalance: runningBalance.toNumber(),
		});
	}

	applyResetsThrough(null);

	return {
		openingBalance: openingBalance.toNumber(),
		rows,
		totalDebits: totalDebits.toNumber(),
		totalCredits: totalCredits.toNumber(),
		closingBalance: runningBalance.toNumber(),
	};
}

/**
 * Narrows ledger rows to those matching `q` without recomputing balances, so
 * every visible row keeps the running balance of the full period. Year reset
 * rows are always kept so balance drops stay explained.
 */
export function filterGeneralLedgerRows<TRow extends GeneralLedgerRow>(
	rows: TRow[],
	q: string | undefined
) {
	const term = q?.trim().toLowerCase();

	if (!term) {
		return rows;
	}

	return rows.filter(
		(row) =>
			row.kind === "year-reset" ||
			[row.memo, row.reference, row.source, row.description].some((value) =>
				value?.toLowerCase().includes(term)
			)
	);
}
