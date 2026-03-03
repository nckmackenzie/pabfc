import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, lte, type SQL, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { bankAccounts, bankPostings } from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { bankingReportFormSchema } from "./schema";

export const getBankingReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(bankingReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:bankings-report");

		const { dateRange, bankId, reportType, status } = data;
		if (!dateRange.from || !dateRange.to) {
			throw new ApplicationError("Date range is required");
		}

		const { from, to } = normalizeDateRange(dateRange.from, dateRange.to);
		const filters: Array<SQL> = [
			eq(bankPostings.bankId, bankId),
			gte(bankPostings.transactionDate, from),
			lte(bankPostings.transactionDate, to),
		];

		if (reportType === "by-status" && status && status !== "both") {
			filters.push(eq(bankPostings.cleared, status === "cleared"));
		}

		return db
			.select({
				transactionDate: bankPostings.transactionDate,
				amount:
					sql<string>`case when ${bankPostings.dc} = 'debit' then ${bankPostings.amount} else (${bankPostings.amount} * -1) end`.as(
						"amount",
					),
				reference: bankPostings.reference,
				description: bankPostings.narration,
				status: sql<
					"cleared" | "uncleared"
				>`case when ${bankPostings.cleared} = true then 'cleared' else 'uncleared' end`.as(
					"status",
				),
				clearDate: bankPostings.clearedAt,
			})
			.from(bankPostings)
			.innerJoin(bankAccounts, eq(bankAccounts.id, bankPostings.bankId))
			.where(and(...filters))
			.orderBy(asc(bankPostings.transactionDate), asc(bankPostings.reference));
	});
