import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import z from "zod";
import { db } from "@/drizzle/db";
import { journalEntries, journalLines, ledgerAccounts } from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { dateRangeRequiredSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type IncomeStatementParentRow = {
	id: number;
	code: string | null;
	name: string;
	type: "revenue" | "expense";
	total: string;
};

export const getIncomeStatement = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(dateRangeRequiredSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:income-statement");
		const {
			dateRange: { from, to },
		} = data;
		if (!from || !to) throw new ApplicationError("Date range is required");

		const { from: dateFrom, to: dateTo } = normalizeDateRange(from, to);

		const parent = await db.execute<{ rows: IncomeStatementParentRow[] }>(sql`
       WITH RECURSIVE tree AS (
          SELECT
            a.id AS reporting_id,
            a.id AS node_id
          FROM ledger_accounts a
          WHERE a.type IN ('revenue', 'expense')
            AND a.is_active = true
            AND a.is_posting = false

        UNION ALL

        SELECT
          t.reporting_id,
          c.id AS node_id
        FROM tree t
        JOIN ledger_accounts c
          ON c.parent_id = t.node_id
        WHERE c.is_active = true
      ),
      posting_nodes AS (
        SELECT
          t.reporting_id,
          p.id AS posting_id,
          p.type AS posting_type,
          p.normal_balance AS posting_normal_balance
        FROM tree t
        JOIN ledger_accounts p
          ON p.id = t.node_id
        WHERE p.is_posting = true
          AND p.type IN ('revenue', 'expense')
      ),
      posting_balances AS (
        SELECT
          jl.account_id,
          SUM(CASE WHEN jl.dc = 'debit'  THEN jl.amount ELSE 0 END) AS debits,
          SUM(CASE WHEN jl.dc = 'credit' THEN jl.amount ELSE 0 END) AS credits
        FROM journal_lines jl
        JOIN journal_entries je
          ON je.id = jl.journal_entry_id
        WHERE je.entry_date BETWEEN ${dateFrom} AND ${dateTo}
        GROUP BY jl.account_id
      ),
      rolled_up AS (
        SELECT
          pn.reporting_id,
          SUM(
          CASE
            WHEN pn.posting_normal_balance = 'credit'
              THEN COALESCE(pb.credits, 0) - COALESCE(pb.debits, 0)
            ELSE
              COALESCE(pb.debits, 0) - COALESCE(pb.credits, 0)
          END
        ) AS total
      FROM posting_nodes pn
      LEFT JOIN posting_balances pb
        ON pb.account_id = pn.posting_id
      GROUP BY pn.reporting_id
    )
    SELECT
      r.id,
      r.code,
      r.name,
      r.type,
      COALESCE(ru.total, 0) AS total
    FROM ledger_accounts r
    LEFT JOIN rolled_up ru
      ON ru.reporting_id = r.id
    WHERE r.type IN ('revenue', 'expense')
      AND r.is_active = true
      AND r.is_posting = false
      AND COALESCE(ru.total, 0) <> 0
    ORDER BY r.type, r.code NULLS LAST, r.name;
    `);

		return parent.rows;
	});

export const getIncomeStatementDrillDown = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(
		z.object({
			id: z.number(),
			dateFrom: z.string(),
			dateTo: z.string(),
			q: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		await requirePermission("reports:income-statement");
		const { id, dateFrom, dateTo, q } = data;

		const parentAccountId = await db.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: eq(ledgerAccounts.id, id),
		});

		if (!parentAccountId) throw new ApplicationError("Account not found");

		const { from, to } = normalizeDateRange(dateFrom, dateTo);

		const accountTree = await db.execute<{ id: number }>(sql`
			WITH RECURSIVE account_tree AS (
				SELECT a.id
				FROM ledger_accounts a
				WHERE a.id = ${id}
					AND a.is_active = true

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

		const accountIds = accountTree.rows.map((a) => a.id);

		return db
			.select({
				id: journalLines.id,
				date: journalEntries.entryDate,
				description: journalLines.memo,
				amount: sql<string>`
					CASE
						WHEN ${ledgerAccounts.normalBalance} = 'credit'
							THEN CASE
								WHEN ${journalLines.dc} = 'credit' THEN ${journalLines.amount}
								ELSE -${journalLines.amount}
							END
						ELSE CASE
							WHEN ${journalLines.dc} = 'debit' THEN ${journalLines.amount}
							ELSE -${journalLines.amount}
						END
					END
				`.as("amount"),
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
					gte(journalEntries.entryDate, from),
					lte(journalEntries.entryDate, to),
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
