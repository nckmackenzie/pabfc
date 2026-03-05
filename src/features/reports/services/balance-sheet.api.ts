import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import z from "zod";
import { db } from "@/drizzle/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/drizzle/schema";
import { trialBalanceReportFormSchema } from "@/features/reports/services/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type BalanceSheetRow = {
	id: number | null;
	code: string | null;
	name: string;
	type: "asset" | "liability" | "equity";
	total: string;
	is_computed: number;
	computed_key: string | null;
};

export type BalanceSheetDrillDownRow = {
	id: number;
	date: string;
	description: string | null;
	amount: string;
	dc: "debit" | "credit";
	accountName: string;
	source: string | null;
	reference: string | null;
};

export const getBalanceSheetReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(trialBalanceReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:balance-sheet");
		const { asOfDate } = data;

		const financialYear = await db.query.financialYears.findFirst({
			columns: { startDate: true },
			where: (financialYears, { and, gte, lte }) =>
				and(
					lte(financialYears.startDate, asOfDate),
					gte(financialYears.endDate, asOfDate),
				),
		});

		if (!financialYear) {
			throw new ApplicationError("Financial year not found");
		}
		const res = await db.execute(sql`
           WITH RECURSIVE reporting AS (
                SELECT
                    a.id AS reporting_id,
                    a.id AS node_id
                FROM ledger_accounts a
                WHERE a.type IN ('asset', 'liability', 'equity')
                    AND (
                    a.is_posting = false
                    OR (a.is_posting = true AND a.parent_id IS NULL)
                    )

                UNION ALL

                SELECT
                    r.reporting_id,
                    c.id AS node_id
                FROM reporting r
                JOIN ledger_accounts c
                    ON c.parent_id = r.node_id
                ),
            posting_nodes AS (
                SELECT
                    r.reporting_id,
                    a.id AS posting_id,
                    a.normal_balance AS posting_normal_balance
                FROM reporting r
                JOIN ledger_accounts a
                    ON a.id = r.node_id
                WHERE a.is_posting = true
                ),
            posting_balances AS (
                SELECT
                    jl.account_id,
                    COALESCE(SUM(CASE WHEN jl.dc = 'debit'  THEN jl.amount ELSE 0 END), 0) AS debits,
                    COALESCE(SUM(CASE WHEN jl.dc = 'credit' THEN jl.amount ELSE 0 END), 0) AS credits
                FROM journal_lines jl
                JOIN journal_entries je
                    ON je.id = jl.journal_entry_id
                WHERE je.entry_date BETWEEN ${financialYear.startDate} AND ${asOfDate}
                GROUP BY jl.account_id
                ),
            rolled_up_bs AS (
                SELECT
                    pn.reporting_id,
                    COALESCE(SUM(
                        CASE
                            WHEN pn.posting_normal_balance = 'credit'
                                THEN COALESCE(pb.credits, 0) - COALESCE(pb.debits, 0)
                            ELSE
                                COALESCE(pb.debits, 0) - COALESCE(pb.credits, 0)
                        END
                    ), 0) AS total
                FROM posting_nodes pn
                LEFT JOIN posting_balances pb
                    ON pb.account_id = pn.posting_id
                GROUP BY pn.reporting_id
                ),

            pl_accounts AS (
                SELECT
                    a.id,
                    a.type,
                    a.normal_balance
                FROM ledger_accounts a
                WHERE a.is_posting = true
                    AND a.type IN ('revenue', 'expense')
                ),
            pl_posting_balances AS (
                SELECT
                    jl.account_id,
                    COALESCE(SUM(CASE WHEN jl.dc='debit'  THEN jl.amount ELSE 0 END), 0) AS debits,
                    COALESCE(SUM(CASE WHEN jl.dc='credit' THEN jl.amount ELSE 0 END), 0) AS credits
                FROM journal_lines jl
                JOIN journal_entries je
                    ON je.id = jl.journal_entry_id
                WHERE je.entry_date BETWEEN ${financialYear.startDate} AND ${asOfDate}
                GROUP BY jl.account_id
                ),
            pl_balances AS (
                SELECT
                    pa.id AS account_id,
                    pa.type,
                    pa.normal_balance,
                    COALESCE(pb.debits, 0)  AS debits,
                    COALESCE(pb.credits, 0) AS credits
                FROM pl_accounts pa
                LEFT JOIN pl_posting_balances pb
                    ON pb.account_id = pa.id
                ),
            pl_net_income AS (
                SELECT
                    COALESCE(SUM(
                        CASE
                            WHEN type = 'revenue' THEN
                                CASE WHEN normal_balance = 'credit' THEN credits - debits ELSE debits - credits END
                            WHEN type = 'expense' THEN
                                -1 * (CASE WHEN normal_balance = 'debit' THEN debits - credits ELSE credits - debits END)
                            ELSE 0
                        END
                    ), 0) AS net_income
                FROM pl_balances
                )

            SELECT
                r.id,
                r.code,
                r.name,
                r.type,
                COALESCE(ru.total, 0) AS total,
                0 AS is_computed,
                NULL::text AS computed_key
            FROM ledger_accounts r
            LEFT JOIN rolled_up_bs ru
                ON ru.reporting_id = r.id
            WHERE r.type IN ('asset', 'liability', 'equity')
                AND (
                    r.is_posting = false
                    OR (r.is_posting = true AND r.parent_id IS NULL)
                )
                AND COALESCE(ru.total, 0) <> 0

            UNION ALL

            SELECT
                NULL::int AS id,
                NULL::text AS code,
                'Current Year Earnings' AS name,
                'equity' AS type,
                (SELECT net_income FROM pl_net_income) AS total,
                1 AS is_computed,
                'CURRENT_YEAR_EARNINGS' AS computed_key

            ORDER BY type, is_computed, code NULLS LAST, name;
        `);

		return res.rows as Array<BalanceSheetRow>;
	});

export const getBalanceSheetDrillDown = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(
		z.object({
			id: z.number(),
			asOfDate: z.iso.date(),
			q: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		await requirePermission("reports:balance-sheet");
		const { id, asOfDate, q } = data;

		const parentAccount = await db.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: eq(ledgerAccounts.id, id),
		});

		if (!parentAccount) {
			throw new ApplicationError("Account not found");
		}

		const financialYear = await db.query.financialYears.findFirst({
			columns: { startDate: true },
			where: (financialYears, { and, gte, lte }) =>
				and(
					lte(financialYears.startDate, asOfDate),
					gte(financialYears.endDate, asOfDate),
				),
		});

		if (!financialYear) {
			throw new ApplicationError("Financial year not found");
		}

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
				WHERE c.is_active = true
			)
			SELECT id
			FROM account_tree;
		`);

		const accountIds = accountTree.rows.map((account) => account.id);

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
			.innerJoin(
				journalEntries,
				eq(journalLines.journalEntryId, journalEntries.id),
			)
			.where(
				and(
					inArray(journalLines.accountId, accountIds),
					gte(journalEntries.entryDate, financialYear.startDate),
					lte(journalEntries.entryDate, asOfDate),
					q
						? or(
								ilike(journalLines.memo, `%${q}%`),
								ilike(journalEntries.reference, `%${q}%`),
								ilike(ledgerAccounts.name, `%${q}%`),
								ilike(journalEntries.source, `%${q}%`),
								ilike(
									sql`TO_CHAR(${journalEntries.entryDate}, 'dd/MM/yyyy')`,
									`%${q}%`,
								),
								ilike(sql`${journalLines.amount}::numeric::text`, `%${q}%`),
							)
						: undefined,
				),
			)
			.orderBy(asc(journalEntries.entryDate), asc(journalLines.id));
	});
