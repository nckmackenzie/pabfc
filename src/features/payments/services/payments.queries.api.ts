import { createServerFn } from "@tanstack/react-start";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	members,
	membershipPlans,
	mpesaStkRequests,
	payments,
} from "@/drizzle/schema";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getPaymentStatusFn = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((checkoutRequestId: string) => checkoutRequestId)
	.handler(async ({ data: checkoutRequestId }) => {
		const payment = await db.query.mpesaStkRequests.findFirst({
			where: eq(mpesaStkRequests.checkoutRequestId, checkoutRequestId),
		});

		if (!payment) {
			return { exists: false } as const;
		}

		return {
			exists: true,
			status: payment.status,
			amount: payment.amount,
			phoneNumber: payment.phoneNumber,
		} as const;
	});

export const getPaymentNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const { rows } = await db.execute<{ maxno: number }>(
			sql`SELECT coalesce(MAX(CAST(payment_no AS integer)), 0) as maxno FROM payments`,
		);
		return +rows[0].maxno + 1;
	});

export const getPayments = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		return db
			.select({
				id: payments.id,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				image: members.image,
				plan: membershipPlans.name,
				paymentNo: payments.paymentNo,
				amount: payments.lineTotal,
				reference: payments.reference,
				paymentDate: payments.paymentDate,
				channel: payments.channel,
				status: payments.status,
			})
			.from(payments)
			.innerJoin(members, eq(payments.memberId, members.id))
			.innerJoin(membershipPlans, eq(payments.planId, membershipPlans.id))
			.where(
				q
					? or(
							ilike(members.firstName, `%${q}%`),
							ilike(members.lastName, `%${q}%`),
							ilike(membershipPlans.name, `%${q}%`),
							ilike(payments.paymentNo, `%${q}%`),
							ilike(payments.reference, `%${q}%`),
							ilike(sql`CAST(${payments.lineTotal} AS TEXT)`, `%${q}%`),
							ilike(sql`CAST(${payments.paymentDate} AS TEXT)`, `%${q}%`),
						)
					: undefined,
			);
	});

export const getPayment = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		return db.query.payments.findFirst({
			with: {
				member: { columns: { firstName: true, lastName: true, image: true } },
				plan: { columns: { name: true } },
			},
			where: eq(payments.id, id),
		});
	});
