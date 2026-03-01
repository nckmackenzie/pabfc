import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	expenseDetails,
	expenseHeaders,
	ledgerAccounts,
	payees,
} from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { expenseReportFormSchema } from "./schema";

export const getExpenseReport = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(expenseReportFormSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:expenses-report");

		const { dateRange, reportType, accountId, payeeId } = data;
		const filters: Array<SQL> = [];

		if (!dateRange.from || !dateRange.to) {
			throw new ApplicationError("Date range is required");
		}

		const { from, to } = normalizeDateRange(dateRange.from, dateRange.to);

		if (reportType === "by-expense-account") {
			if (!accountId) throw new ApplicationError("Expense account is required");
			filters.push(eq(expenseDetails.accountId, Number(accountId)));
		}

		if (reportType === "by-payee") {
			if (!payeeId) throw new ApplicationError("Payee is required");
			filters.push(eq(expenseHeaders.payeeId, payeeId));
		}

		const expenseRows = await db
			.select({
				id: expenseHeaders.id,
				expenseDate: expenseHeaders.expenseDate,
				expenseNo: expenseHeaders.expenseNo,
				payee: payees.name,
				amount: expenseHeaders.totalAmount,
				paymentMethod: expenseHeaders.paymentMethod,
			})
			.from(expenseHeaders)
			.innerJoin(payees, eq(expenseHeaders.payeeId, payees.id))
			.innerJoin(
				expenseDetails,
				eq(expenseHeaders.id, expenseDetails.expenseHeaderId),
			)
			.where(
				and(
					gte(expenseHeaders.expenseDate, from),
					lte(expenseHeaders.expenseDate, to),
					...filters,
				),
			)
			.groupBy(
				expenseHeaders.id,
				expenseHeaders.expenseDate,
				expenseHeaders.expenseNo,
				payees.name,
				expenseHeaders.totalAmount,
				expenseHeaders.paymentMethod,
			)
			.orderBy(asc(expenseHeaders.expenseDate), asc(expenseHeaders.expenseNo));

		const expenseIds = expenseRows.map((expense) => expense.id);

		if (expenseIds.length === 0) {
			return [];
		}

		const accountsByExpense = await db
			.select({
				expenseId: expenseDetails.expenseHeaderId,
				expenseAccount: ledgerAccounts.name,
			})
			.from(expenseDetails)
			.innerJoin(
				ledgerAccounts,
				eq(expenseDetails.accountId, ledgerAccounts.id),
			)
			.where(inArray(expenseDetails.expenseHeaderId, expenseIds))
			.orderBy(asc(expenseDetails.expenseHeaderId), asc(ledgerAccounts.name));

		const accountMap = new Map<string, Array<string>>();
		for (const row of accountsByExpense) {
			const values = accountMap.get(row.expenseId) ?? [];
			if (!values.includes(row.expenseAccount)) {
				values.push(row.expenseAccount);
				accountMap.set(row.expenseId, values);
			}
		}

		return expenseRows.map((expense) => ({
			...expense,
			expenseAccount: (accountMap.get(expense.id) ?? []).join(", "),
		}));
	});
