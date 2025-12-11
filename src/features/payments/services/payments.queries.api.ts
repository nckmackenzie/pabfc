import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mpesaStkRequests } from "@/drizzle/schema";
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
		const { rows } = await db.execute<{ paymentNo: number }>(
			sql`SELECT coalesce(MAX(payment_no),'0') FROM payments`,
		);
		return +rows[0].paymentNo + 1;
	});

export const getPayments = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const payments = await db.query.payments.findMany({
			columns: { createdAt: false, updatedAt: false },
			with: {
				member: { columns: { lastName: true, firstName: true, image: true } },
			},
		});
		return payments;
	});
