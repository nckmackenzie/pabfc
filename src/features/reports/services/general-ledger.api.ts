import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/drizzle/schema";
import { groupActivePostingAccountOptionsByParent } from "@/features/coa/services/account-option-filter";
import {
	buildGeneralLedger,
	filterGeneralLedgerRows,
	getOpeningBalanceScope,
} from "@/features/reports/lib/general-ledger";
import {
	listFinancialYearStartsWithin,
	resolveFinancialYearStart,
} from "@/features/reports/services/financial-year";
import { generalLedgerServerSchema } from "@/features/reports/services/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getGeneralLedgerAccountOptions = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("reports:general-ledger");

		const accounts = await db
			.select({
				id: ledgerAccounts.id,
				code: ledgerAccounts.code,
				name: ledgerAccounts.name,
				parentId: ledgerAccounts.parentId,
				isActive: ledgerAccounts.isActive,
				isPosting: ledgerAccounts.isPosting,
			})
			.from(ledgerAccounts);

		return groupActivePostingAccountOptionsByParent(accounts);
	});

async function getOpeningTotals(accountId: number, dateFrom: string, periodStart: string | null) {
	const [totals] = await db
		.select({
			debits: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.dc} = 'debit' THEN ${journalLines.amount} ELSE 0 END), 0)`,
			credits: sql<string>`COALESCE(SUM(CASE WHEN ${journalLines.dc} = 'credit' THEN ${journalLines.amount} ELSE 0 END), 0)`,
		})
		.from(journalLines)
		.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
		.where(
			and(
				eq(journalLines.accountId, accountId),
				lt(journalEntries.entryDate, dateFrom),
				periodStart ? gte(journalEntries.entryDate, periodStart) : undefined
			)
		);

	return totals ?? { debits: "0", credits: "0" };
}

function getPeriodLines(accountId: number, dateFrom: string, dateTo: string) {
	return db
		.select({
			id: journalLines.id,
			date: journalEntries.entryDate,
			memo: journalLines.memo,
			description: journalEntries.description,
			source: journalEntries.source,
			reference: journalEntries.reference,
			dc: journalLines.dc,
			amount: journalLines.amount,
		})
		.from(journalLines)
		.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
		.where(
			and(
				eq(journalLines.accountId, accountId),
				gte(journalEntries.entryDate, dateFrom),
				lte(journalEntries.entryDate, dateTo)
			)
		)
		.orderBy(asc(journalEntries.entryDate), asc(journalLines.id));
}

export const getGeneralLedger = createServerFn()
	.middleware([authMiddleware])
	.validator(generalLedgerServerSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:general-ledger");

		const { dateRange, q } = data;
		const accountId = Number(data.accountId);

		if (!dateRange.from || !dateRange.to) {
			throw new ApplicationError("Date range is required");
		}

		const account = await db.query.ledgerAccounts.findFirst({
			columns: {
				id: true,
				code: true,
				name: true,
				type: true,
				normalBalance: true,
				isPosting: true,
			},
			where: eq(ledgerAccounts.id, accountId),
		});

		if (!account) {
			throw new ApplicationError("Account not found");
		}

		if (!account.isPosting) {
			throw new ApplicationError("General ledger is only available for posting accounts");
		}

		const openingBalanceScope = getOpeningBalanceScope(account.type);

		// Balance sheet accounts carry full history, so they need no financial year.
		const [financialYearStart, yearStartDates]: [string | null, string[]] =
			openingBalanceScope === "fiscal-year"
				? await Promise.all([
						resolveFinancialYearStart(dateRange.from),
						listFinancialYearStartsWithin(dateRange.from, dateRange.to),
					])
				: [null, []];

		const [openingTotals, lines] = await Promise.all([
			getOpeningTotals(account.id, dateRange.from, financialYearStart),
			getPeriodLines(account.id, dateRange.from, dateRange.to),
		]);

		const ledger = buildGeneralLedger({
			normalBalance: account.normalBalance,
			openingDebits: openingTotals.debits,
			openingCredits: openingTotals.credits,
			lines,
			yearStartDates,
		});

		return {
			account: {
				id: account.id,
				code: account.code,
				name: account.name,
				type: account.type,
				normalBalance: account.normalBalance,
			},
			openingBalanceScope,
			financialYearStart,
			...ledger,
			rows: filterGeneralLedgerRows(ledger.rows, q),
		};
	});

export type GeneralLedgerReport = Awaited<ReturnType<typeof getGeneralLedger>>;
