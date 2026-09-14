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
 *   year containing the report start.
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

export type GeneralLedgerRow = Omit<GeneralLedgerLine, "dc" | "amount"> & {
	debit: number;
	credit: number;
	runningBalance: number;
};

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
	return normalBalance === "debit" ? toBig(debit).minus(toBig(credit)) : toBig(credit).minus(toBig(debit));
}

/**
 * Walks ordered journal lines from the opening balance, producing a running
 * balance per row signed by the account's normal balance, plus period totals.
 */
export function buildGeneralLedger({
	normalBalance,
	openingDebits,
	openingCredits,
	lines,
}: {
	normalBalance: NormalBalance;
	openingDebits: NumericValue;
	openingCredits: NumericValue;
	lines: GeneralLedgerLine[];
}): GeneralLedgerResult {
	const openingBalance = netMovement(normalBalance, openingDebits, openingCredits);
	let runningBalance = openingBalance;
	let totalDebits = toBig(0);
	let totalCredits = toBig(0);

	const rows = lines.map(({ dc, amount, ...line }) => {
		const debit = dc === "debit" ? toBig(amount) : toBig(0);
		const credit = dc === "credit" ? toBig(amount) : toBig(0);

		totalDebits = totalDebits.plus(debit);
		totalCredits = totalCredits.plus(credit);
		runningBalance = runningBalance.plus(netMovement(normalBalance, debit, credit));

		return {
			...line,
			debit: debit.toNumber(),
			credit: credit.toNumber(),
			runningBalance: runningBalance.toNumber(),
		};
	});

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
 * every visible row keeps the running balance of the full period.
 */
export function filterGeneralLedgerRows<TRow extends GeneralLedgerRow>(rows: TRow[], q: string | undefined) {
	const term = q?.trim().toLowerCase();

	if (!term) {
		return rows;
	}

	return rows.filter((row) =>
		[row.memo, row.reference, row.source, row.description].some((value) =>
			value?.toLowerCase().includes(term)
		)
	);
}
