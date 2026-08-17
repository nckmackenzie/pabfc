import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from "drizzle-orm";
import z from "zod";
import { db } from "@/drizzle/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/drizzle/schema";
import type { AccountType } from "@/drizzle/schemas/chart-of-accounts";
import { resolveFinancialYearStart } from "@/features/reports/services/financial-year";
import { trialBalanceReportFormSchema } from "@/features/reports/services/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type TrialBalanceRow = {
	id: number;
	code: string | null;
	name: string;
	type: AccountType;
	isPosting: boolean;
	hasChildren: boolean;
	total_debits: string;
	total_credits: string;
	debit_balance: string;
	credit_balance: string;
};

export type TrialBalanceDrillDownRow = {
	id: number;
	date: string;
	description: string | null;
	amount: string;
	dc: "debit" | "credit";
	accountName: string;
	source: string | null;
	reference: string | null;
};

/**
 * Rolls every reporting node matched by `rootFilter` up over its own subtree of
 * posting accounts and returns the non-zero balances for the financial period.
 *
 * `rootFilter` must be expressed against the `a` alias (for example
 * `sql`a.parent_id IS NULL`` for the top level of the report, or
 * `sql`a.parent_id = ${id}`` for the direct children of a single account).
 */
async function getRolledUpBalances(rootFilter: SQL, startDate: string, asOfDate: string) {
	const res = await db.execute(sql`
		WITH RECURSIVE tree AS (

			SELECT a.id AS reporting_id, a.id AS node_id
			FROM ledger_accounts a
			WHERE ${rootFilter}

			UNION ALL

			SELECT t.reporting_id, c.id AS node_id
			FROM tree t
			JOIN ledger_accounts c
				ON c.parent_id = t.node_id
		),
		posting_nodes AS (
			SELECT t.reporting_id, p.id AS posting_id
			FROM tree t
			JOIN ledger_accounts p
				ON p.id = t.node_id
			WHERE p.is_posting = true
		),
		posting_sums AS (
			SELECT
				jl.account_id,
				SUM(CASE WHEN jl.dc = 'debit'  THEN jl.amount ELSE 0 END) AS debits,
				SUM(CASE WHEN jl.dc = 'credit' THEN jl.amount ELSE 0 END) AS credits
			FROM journal_lines jl
			JOIN journal_entries je
				ON je.id = jl.journal_entry_id
			WHERE je.entry_date BETWEEN ${startDate} AND ${asOfDate}
			GROUP BY jl.account_id
		),
		rolled AS (
			SELECT
				pn.reporting_id,
				COALESCE(SUM(ps.debits), 0)  AS total_debits,
				COALESCE(SUM(ps.credits), 0) AS total_credits
			FROM posting_nodes pn
			LEFT JOIN posting_sums ps
				ON ps.account_id = pn.posting_id
			GROUP BY pn.reporting_id
		)
		SELECT
			a.id,
			a.code,
			a.name,
			a.type,
			a.is_posting AS "isPosting",
			EXISTS (
				SELECT 1
				FROM ledger_accounts child
				WHERE child.parent_id = a.id
			) AS "hasChildren",
			rolled.total_debits,
			rolled.total_credits,
			CASE WHEN (rolled.total_debits - rolled.total_credits) > 0
				THEN (rolled.total_debits - rolled.total_credits)
				ELSE 0
			END AS debit_balance,
			CASE WHEN (rolled.total_debits - rolled.total_credits) < 0
				THEN (rolled.total_credits - rolled.total_debits)
				ELSE 0
			END AS credit_balance
		FROM ledger_accounts a
		JOIN rolled ON rolled.reporting_id = a.id
		WHERE ${rootFilter}
		AND (rolled.total_debits <> rolled.total_credits)
		ORDER BY a.code NULLS LAST, a.name;
	`);

	return res.rows as Array<TrialBalanceRow>;
}

export const getTrialBalance = createServerFn()
	.middleware([authMiddleware])
	.validator(trialBalanceReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:trial-balance");
		const { asOfDate } = data;

		const startDate = await resolveFinancialYearStart(asOfDate);

		return getRolledUpBalances(sql`a.parent_id IS NULL`, startDate, asOfDate);
	});

export const getTrialBalanceChildren = createServerFn()
	.middleware([authMiddleware])
	.validator(z.object({ id: z.number(), asOfDate: z.iso.date() }))
	.handler(async ({ data }) => {
		await requirePermission("reports:trial-balance");
		const { id, asOfDate } = data;

		const startDate = await resolveFinancialYearStart(asOfDate);

		return getRolledUpBalances(sql`a.parent_id = ${id}`, startDate, asOfDate);
	});

export const getTrialBalanceDrillDown = createServerFn()
	.middleware([authMiddleware])
	.validator(
		z.object({
			id: z.number(),
			asOfDate: z.iso.date(),
			q: z.string().optional(),
		})
	)
	.handler(async ({ data }) => {
		await requirePermission("reports:trial-balance");
		const { id, asOfDate, q } = data;

		const parentAccount = await db.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: eq(ledgerAccounts.id, id),
		});

		if (!parentAccount) {
			throw new ApplicationError("Account not found");
		}

		const startDate = await resolveFinancialYearStart(asOfDate);

		const accountTree = await db.execute<{ id: number }>(sql`
			WITH RECURSIVE account_tree AS (
				SELECT a.id
				FROM ledger_accounts a
				WHERE a.id = ${id}

				UNION ALL

				SELECT c.id
				FROM ledger_accounts c
				JOIN account_tree t
					ON c.parent_id = t.id
			)
			SELECT id
			FROM account_tree;
		`);

		const accountIds = accountTree.rows.map((account) => account.id);

		if (accountIds.length === 0) {
			return [];
		}

		return db
			.select({
				id: journalLines.id,
				date: journalEntries.entryDate,
				description: journalLines.memo,
				amount: journalLines.amount,
				dc: journalLines.dc,
				accountName: ledgerAccounts.name,
				source: journalEntries.source,
				reference: journalEntries.reference,
			})
			.from(journalLines)
			.innerJoin(ledgerAccounts, eq(journalLines.accountId, ledgerAccounts.id))
			.innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
			.where(
				and(
					inArray(journalLines.accountId, accountIds),
					gte(journalEntries.entryDate, startDate),
					lte(journalEntries.entryDate, asOfDate),
					q
						? or(
								ilike(journalLines.memo, `%${q}%`),
								ilike(journalEntries.reference, `%${q}%`),
								ilike(ledgerAccounts.name, `%${q}%`),
								ilike(journalEntries.source, `%${q}%`),
								ilike(sql`TO_CHAR(${journalEntries.entryDate}, 'dd/MM/yyyy')`, `%${q}%`),
								ilike(sql`${journalLines.amount}::numeric::text`, `%${q}%`)
							)
						: undefined
				)
			)
			.orderBy(asc(journalEntries.entryDate), asc(journalLines.id));
	});
