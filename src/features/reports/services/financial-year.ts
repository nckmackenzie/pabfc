import { db } from "@/drizzle/db";
import { ApplicationError } from "@/lib/error-handling/app-error";

/**
 * Resolves the start of the financial year that contains `asOfDate`.
 *
 * Server-side only: this is a plain helper shared by the reporting server
 * functions, never exposed to the client directly.
 */
export async function resolveFinancialYearStart(asOfDate: string) {
	const financialYear = await db.query.financialYears.findFirst({
		columns: { startDate: true },
		where: (financialYears, { and, gte, lte }) =>
			and(lte(financialYears.startDate, asOfDate), gte(financialYears.endDate, asOfDate)),
	});

	if (!financialYear) {
		throw new ApplicationError("Financial year not found");
	}

	return financialYear.startDate;
}
