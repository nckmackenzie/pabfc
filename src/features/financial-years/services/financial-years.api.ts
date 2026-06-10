import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, ilike, lte, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { financialYears } from "@/drizzle/schema";
import { checkFinancialYearConflict } from "@/features/financial-years/services/helpers";
import {
	type FinancialYearSchema,
	financialYearSchema,
} from "@/features/financial-years/services/schemas";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export const getFinancialYears = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("financial-years:view");
		const filters: Array<SQL> = [];

		if (q) {
			const searchFilter = or(
				ilike(financialYears.name, `%${q}%`),
				ilike(sql`CAST(${financialYears.startDate} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${financialYears.endDate} AS TEXT)`, `%${q}%`),
			);
			if (searchFilter) filters.push(searchFilter);
		}

		return db
			.select()
			.from(financialYears)
			.where(and(...filters))
			.orderBy(desc(financialYears.startDate));
	});

export const getFinancialYear = createServerFn()
	.middleware([authMiddleware])
	.validator((financialYearId: string) => financialYearId)
	.handler(async ({ data: financialYearId }) => {
		await requirePermission("financial-years:view");
		const financialYear = await db.query.financialYears.findFirst({
			where: eq(financialYears.id, financialYearId),
		});

		if (!financialYear) throw notFound();
		return financialYear;
	});

export const upsertFinancialYear = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(financialYearSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission(
				data.id ? "financial-years:update" : "financial-years:create",
			);

			try {
				await checkFinancialYearConflict(
					data.name,
					data.startDate,
					data.endDate,
					data.id,
				);

				const values = {
					name: data.name,
					startDate: data.startDate,
					endDate: data.endDate,
					closed: data.id ? data.closed : false,
					closedDate: data.id
						? data.closed
							? (data.closedDate ?? null)
							: null
						: null,
				} satisfies Omit<FinancialYearSchema, "id">;

				if (data.id) {
					await db
						.update(financialYears)
						.set(values)
						.where(eq(financialYears.id, data.id));
				} else {
					await db
						.insert(financialYears)
						.values(values)
						.returning({ id: financialYears.id });
				}

				await logActivity({
					data: {
						action: data.id ? "update financial year" : "create financial year",
						description: data.id
							? `Updated financial year with name ${data.name}`
							: `Created financial year with name ${data.name}`,
						userId,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to upsert financial year",
				});
			}
		},
	);

export const deleteFinancialYear = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((financialYearId: string) => financialYearId)
	.handler(
		async ({
			data: financialYearId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("financial-years:delete");

			try {
				const financialYear = await db.query.financialYears.findFirst({
					columns: { name: true, closed: true },
					where: eq(financialYears.id, financialYearId),
				});

				if (!financialYear) {
					return failure({
						type: "NotFoundError",
						message: "Financial year not found",
					});
				}

				if (financialYear.closed) {
					return failure({
						type: "ApplicationError",
						message: "Financial year is closed",
					});
				}

				await db
					.delete(financialYears)
					.where(eq(financialYears.id, financialYearId));

				await logActivity({
					data: {
						action: "delete financial year",
						description: `Deleted financial year with id ${financialYearId}`,
						userId,
					},
				});
				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete financial year",
				});
			}
		},
	);

export const getCurrentFinancialYear = createServerFn().handler(async () => {
	const currentFinancialYear = await db.query.financialYears.findFirst({
		where: and(
			lte(financialYears.startDate, sql`CURRENT_DATE`),
			gte(financialYears.endDate, sql`CURRENT_DATE`),
		),
	});
	return currentFinancialYear;
});
