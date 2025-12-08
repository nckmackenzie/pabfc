import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { memberMemberships, membershipPlans } from "@/drizzle/schema";
import { type PlanSchema, planSchema } from "@/features/plans/services/schemas";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export const getPlans = createServerFn()
	.middleware([authMiddleware])
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
	.middleware([authMiddleware])
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
						revenueAccountId: +data.revenueAccountId,
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

export const getPlan = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((data: string) => data)
	.handler(async ({ data: planId }) => {
		return db.query.membershipPlans.findFirst({
			where: eq(membershipPlans.id, planId),
		});
	});

export const updatePlan = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: { values: PlanSchema; planId: string }) => data)
	.handler(
		async ({
			data: { values, planId },
			context: {
				user: { id: userId },
			},
		}) => {
			if (await planNameExists({ data: { value: values.name, planId } })) {
				throw new ConflictError("Plan");
			}

			await db.transaction(async (tx) => {
				await tx
					.update(membershipPlans)
					.set({
						...values,
						sessionCount: values.isSessionBased
							? (values.sessionCount ?? 0)
							: 0,
						description: values.description ?? null,
						revenueAccountId: +values.revenueAccountId,
					})
					.where(eq(membershipPlans.id, planId));

				await logActivity({
					data: {
						description: `Updated plan ${values.name} details`,
						userId,
						action: "update plan",
					},
				});
			});

			return planId;
		},
	);

export const deletePlan = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: string) => data)
	.handler(
		async ({
			data: planId,
			context: {
				user: { id: userId },
			},
		}) => {
			const plan = await db.query.membershipPlans.findFirst({
				where: eq(membershipPlans.id, planId),
			});
			if (!plan) {
				throw new NotFoundError("Plan");
			}

			const referenced = await db.query.memberMemberships.findFirst({
				columns: { id: true },
				where: eq(memberMemberships.membershipPlanId, planId),
			});

			if (referenced) {
				throw new Error("Plan is being referenced and cannot be deleted!!");
			}

			await db.delete(membershipPlans).where(eq(membershipPlans.id, planId));

			await logActivity({
				data: {
					description: `Deleted plan ${plan.name}`,
					userId,
					action: "delete plan",
				},
			});
		},
	);

export const planNameExists = createServerFn()
	.middleware([authMiddleware])
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
