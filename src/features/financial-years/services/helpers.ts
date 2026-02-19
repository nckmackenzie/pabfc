import { and, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { financialYears } from "@/drizzle/schema";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { normalizeDateRange } from "@/lib/helpers";

export const checkFinancialYearConflict = async (
	name: string,
	startDate: string,
	endDate: string,
	id?: string,
) => {
	const { from, to } = normalizeDateRange(startDate, endDate);

	const financialYear = await db.query.financialYears.findFirst({
		where: and(
			or(
				eq(sql`LOWER(${financialYears.name})`, name.toLowerCase()),
				and(
					lte(financialYears.startDate, to),
					gte(financialYears.endDate, from),
				),
			),
			id ? ne(financialYears.id, id) : undefined,
		),
	});

	if (financialYear) {
		if (financialYear.name.toLowerCase() === name.toLowerCase()) {
			throw new ApplicationError(`Name "${name}" already exists`);
		} else {
			throw new ApplicationError(
				`Dates overlap with existing year "${financialYear.name}"`,
			);
		}
	}
};
