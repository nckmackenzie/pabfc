import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { startOfMonth, startOfYear } from "date-fns";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	lt,
	max,
	ne,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
	attendanceLogs,
	memberMemberships,
	members,
	membershipPlans,
	payments,
} from "@/drizzle/schema";
import { getStatDates } from "@/features/dashboard/lib/helpers";
import { type PlanSchema, planSchema } from "@/features/plans/services/schemas";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { dateFormat } from "@/lib/helpers";
import { paymentFilters } from "@/lib/query-helpers";
import {
	type dateRangeWithSearchSchema,
	type reportDateRangeSchema,
	searchValidateSchema,
} from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type PlanWithDateRange = {
	planId: string;
	dateRange: z.infer<typeof reportDateRangeSchema>;
};

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

export const getPlanActiveMembers = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((data: string) => data)
	.handler(async ({ data: planId }) => {
		return db.query.memberMemberships.findMany({
			columns: { memberId: true },
			where: and(
				eq(memberMemberships.membershipPlanId, planId),
				eq(memberMemberships.status, "active"),
			),
		});
	});

export const getPlanWithSummary = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((data: string) => data)
	.handler(async ({ data: planId }) => {
		const planDetails = await db.query.membershipPlans.findFirst({
			where: eq(membershipPlans.id, planId),
		});
		if (!planDetails) {
			throw notFound();
		}

		const { startOfLast30Days } = getStatDates();

		const [activeMembersCount, expiredMembersCount] = await Promise.all([
			db.$count(
				memberMemberships,
				and(
					eq(memberMemberships.membershipPlanId, planId),
					eq(memberMemberships.status, "active"),
				),
			),
			db.$count(
				memberMemberships,
				and(
					eq(memberMemberships.membershipPlanId, planId),
					eq(memberMemberships.status, "expired"),
					gte(memberMemberships.endDate, dateFormat(startOfLast30Days)),
					lt(memberMemberships.endDate, dateFormat(new Date())),
				),
			),
		]);

		return { planDetails, activeMembersCount, expiredMembersCount };
	});

export const getPlanMembers = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(
		(data: { planId: string; filters: z.infer<typeof searchValidateSchema> }) =>
			data,
	)
	.handler(async ({ data }) => {
		const {
			planId,
			filters: { q },
		} = data;

		const lastAttendances = db
			.select({
				memberId: attendanceLogs.memberId,
				lastAttendanceDate: max(attendanceLogs.checkInTime).as(
					"last_attendance_date",
				),
			})
			.from(attendanceLogs)
			.groupBy(attendanceLogs.memberId)
			.as("last_attendances");

		return await db
			.select({
				id: memberMemberships.id,
				endDate: memberMemberships.endDate,
				priceCharged: memberMemberships.priceCharged,
				startDate: memberMemberships.startDate,
				member: {
					image: members.image,
					firstName: members.firstName,
					lastName: members.lastName,
				},
				lastAttendance: lastAttendances.lastAttendanceDate,
			})
			.from(memberMemberships)
			.innerJoin(members, eq(memberMemberships.memberId, members.id))
			.leftJoin(
				lastAttendances,
				eq(memberMemberships.memberId, lastAttendances.memberId),
			)
			.where(
				and(
					eq(memberMemberships.membershipPlanId, planId),
					eq(memberMemberships.status, "active"),
					q
						? or(
								ilike(members.firstName, `%${q}%`),
								ilike(members.lastName, `%${q}%`),
								ilike(
									sql`CAST(${memberMemberships.startDate} AS TEXT)`,
									`%${q}%`,
								),
								ilike(
									sql`CAST(${memberMemberships.endDate} AS TEXT)`,
									`%${q}%`,
								),
								ilike(
									sql`CAST(${memberMemberships.priceCharged} AS TEXT)`,
									`%${q}%`,
								),
							)
						: undefined,
				),
			)
			.orderBy(asc(sql`lower(${members.firstName})`));
	});

export const getPlanRevenueStats = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((data: PlanWithDateRange) => data)
	.handler(async ({ data: { dateRange, planId } }) => {
		const dateFrom = dateRange.from
			? new Date(dateRange.from)
			: startOfYear(new Date());
		const dateTo = dateRange.to ? new Date(dateRange.to) : new Date();
		const filters = paymentFilters({
			planId,
			dateFrom,
			dateTo,
			status: "completed",
		});

		const [totalRevenue, averagePayment, revenueThisMonth, totalPayment] =
			await Promise.all([
				db
					.select({
						totalRevenue:
							sql<string>`coalesce(sum(${payments.amount}),0)`.mapWith(Number),
					})
					.from(payments)
					.where(filters),
				db
					.select({
						averagePayment:
							sql<string>`AVG(CAST(COALESCE(${payments.amount}, 0) AS DECIMAL(10,2)))`.mapWith(
								Number,
							),
					})
					.from(payments)
					.where(filters),
				db
					.select({
						revenueThisMonth:
							sql<string>`coalesce(sum(${payments.amount}),0)`.mapWith(Number),
					})
					.from(payments)
					.where(
						paymentFilters({
							dateFrom: startOfMonth(new Date()),
							dateTo: new Date(),
							planId,
							status: "completed",
						}),
					),
				db
					.select({
						totalRevenue:
							sql<string>`coalesce(sum(${payments.amount}),0)`.mapWith(Number),
					})
					.from(payments)
					.where(
						paymentFilters({
							dateFrom,
							dateTo,
							status: "completed",
						}),
					),
			]);

		return {
			totalPlanPayment: totalRevenue[0].totalRevenue,
			averagePayment: averagePayment[0].averagePayment ?? 0,
			revenueThisMonth: revenueThisMonth[0].revenueThisMonth,
			totalPayment: totalPayment[0].totalRevenue,
		};
	});

export const getPlanPaymentsByDuration = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(
		(data: {
			planId: string;
			filters: z.infer<typeof dateRangeWithSearchSchema>;
		}) => data,
	)
	.handler(async ({ data }) => {
		const {
			planId,
			filters: { from, to, q },
		} = data;
		const dateFrom = from ? new Date(from) : startOfYear(new Date());
		const dateTo = to ? new Date(to) : new Date();
		const extraFilters: Array<SQL> = [];
		if (q) {
			const searchFilters = or(
				ilike(sql`CAST(${payments.paymentNo} AS TEXT)`, `%${q}%`),
				ilike(payments.reference, `%${q}%`),
				ilike(members.firstName, `%${q}%`),
				ilike(members.lastName, `%${q}%`),
				ilike(sql`CAST(${payments.totalAmount} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${payments.paymentDate} AS TEXT)`, `%${q}%`),
				ilike(sql`CAST(${payments.method} AS TEXT)`, `%${q}%`),
			);
			if (searchFilters) {
				extraFilters.push(searchFilters);
			}
		}

		return db
			.select({
				id: payments.id,
				paymentNo: payments.paymentNo,
				reference: payments.reference,
				paymentMethod: payments.method,
				amount: payments.totalAmount,
				paymentDate: payments.paymentDate,
				member: {
					firstName: members.firstName,
					lastName: members.lastName,
					image: members.image,
				},
			})
			.from(payments)
			.innerJoin(members, eq(payments.memberId, members.id))
			.where(
				paymentFilters({
					dateFrom,
					dateTo,
					status: "completed",
					planId,
					conditions: extraFilters,
				}),
			)
			.orderBy(desc(payments.paymentDate));
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
