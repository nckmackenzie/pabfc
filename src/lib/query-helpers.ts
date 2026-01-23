import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { expenseHeaders, payments } from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";

type QuerySql = {
	conditions?: Array<SQL>;
};

type PaymentFiltersProps = QuerySql & {
	dateFrom: Date;
	dateTo: Date;
	planId?: string;
	status?: "pending" | "completed" | "failed" | "cancelled" | "refunded";
};

type ExpenseFiltersProps = {
	dateFrom: Date;
	dateTo: Date;
};

export function paymentFilters({
	dateFrom,
	dateTo,
	planId,
	status,
	conditions,
}: PaymentFiltersProps) {
	const filters: Array<SQL> = [];
	if (planId) {
		filters.push(eq(payments.planId, planId));
	}
	if (status) {
		filters.push(eq(payments.status, status));
	}
	filters.push(gte(payments.paymentDate, dateFrom));
	filters.push(lte(payments.paymentDate, dateTo));

	if (conditions) {
		filters.push(...conditions);
	}
	return and(...filters);
}

export function expenseFilters({ dateFrom, dateTo }: ExpenseFiltersProps) {
	const filters: Array<SQL> = [];

	filters.push(gte(expenseHeaders.expenseDate, dateFormat(dateFrom)));
	filters.push(lte(expenseHeaders.expenseDate, dateFormat(dateTo)));
	return and(...filters);
}
