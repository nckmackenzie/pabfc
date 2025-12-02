import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { membershipPlans } from "@/drizzle/schema";
import { planSchema } from "@/features/plans/services/schemas";
import { ConflictError } from "@/lib/error-handling/app-error";
import { searchValidateSchema } from "@/lib/schema-rules";
import { permissionsMiddleware } from "@/middlewares/permission-middleware";
import { logActivity } from "@/services/activity-logger";

export const getPlans = createServerFn()
	.middleware([permissionsMiddleware(["plans:view"])])
	.inputValidator(searchValidateSchema)
	.handler(async ({ data }) => {
		return db.query.membershipPlans.findMany({
			where: data.q
				? or(
						ilike(membershipPlans.name, `%${data.q}%`),
						ilike(
							sql`CAST(${membershipPlans.duration} AS TEXT)`,
							`%${data.q}%`,
						),
						ilike(sql`CAST(${membershipPlans.price} AS TEXT)`, `%${data.q}%`),
					)
				: undefined,
			orderBy: asc(sql`
             lower(${membershipPlans.name})   
            `),
		});
	});

export const createPlan = createServerFn({ method: "POST" })
	.middleware([permissionsMiddleware(["plans:create"])])
	.inputValidator(planSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			if (await planNameExists({ data: { value: data.name } })) {
				throw new ConflictError("Plan");
			}

			const planId = await db.transaction(async (tx) => {
				const [{ id }] = await tx
					.insert(membershipPlans)
					.values({
						...data,
						sessionCount: data.isSessionBased ? (data.sessionCount ?? 0) : 0,
						description: data.description ?? null,
					})
					.returning({ id: membershipPlans.id });

				await logActivity({
					data: {
						description: `Created plan ${data.name}`,
						userId,
						action: "create plan",
					},
				});

				return id;
			});

			return planId;
		},
	);

export const planNameExists = createServerFn()
	.middleware([permissionsMiddleware(["plans:create"])])
	.inputValidator((data: { value: string; planId?: string }) => data)
	.handler(async ({ data: { value, planId } }) => {
		return db.query.membershipPlans.findFirst({
			columns: { id: true },
			where: and(
				eq(sql`lower(${membershipPlans.name})`, value.toLowerCase()),
				planId ? ne(membershipPlans.id, planId) : undefined,
			),
		});
	});
