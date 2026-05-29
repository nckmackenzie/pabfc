import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { mpesaStkRequests, payments } from "@/drizzle/schema";
import { finalizeMembershipPayment } from "@/features/receipts/services/membership-payment-finalizer";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import { paymentSchema } from "@/features/receipts/services/schemas";
import {
	discountCalculator,
	generateFullPaymentInvoiceNo,
	taxCalculator,
} from "@/lib/helpers";
import { initiateMpesaStkPush, registerUrlCallacks } from "@/lib/mpesa";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

const stkPaymentSchema = paymentSchema.extend({
	phoneNumber: z
		.string()
		.min(1, { error: "Phone Number is required" })
		.regex(/254\d{9}/, { error: "Invalid phone number" }),
});

export const initiateStkPushFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(stkPaymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");

			const {
				phoneNumber,
				memberId,
				planId,
				paymentDate,
				discountType,
				discount,
			} = data;
			const paymentNo = await getPaymentNo();
			const settings = await db.query.settings.findFirst({
				columns: { billing: true },
			});

			const plan = await db.query.membershipPlans.findFirst({
				where: (plans, { eq }) => eq(plans.id, planId),
			});

			if (!plan) {
				throw new Error("Plan not found");
			}

			const discountedAmount = discountCalculator(
				discountType,
				discount ?? 0,
				plan.price,
			);

			const amount = plan.price - discountedAmount;

			const accountReference = generateFullPaymentInvoiceNo(
				paymentNo,
				settings?.billing?.invoicePrefix,
				settings?.billing?.invoiceNumberPadding,
			);

			const mpesaRes = await initiateMpesaStkPush({
				amount,
				phoneNumber,
				accountReference,
				transactionDesc: "Membership Plan Payment",
			});

			const checkoutRequestId = mpesaRes.CheckoutRequestID;
			const merchantRequestId = mpesaRes.MerchantRequestID;

			const taxType = settings?.billing?.applyTaxToMembership
				? (settings.billing?.vatType ?? "inclusive")
				: "none";
			const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(
				amount,
				taxType,
			);

			const paymentId = await db.transaction(async (tx) => {
				await tx.insert(mpesaStkRequests).values({
					memberId,
					amount: amount.toString(),
					initiatedChannel: "staff",
					phoneNumber,
					checkoutRequestId,
					merchantRequestId,
					status: "pending",
				});

				const [{ id }] = await tx
					.insert(payments)
					.values({
						paymentDate: new Date(paymentDate),
						amount: plan.price.toString(),
						lineTotal: amountExlusiveTax.toString(),
						memberId,
						planId,
						paymentNo: paymentNo.toString(),
						status: "pending",
						discountType,
						discount: discount ? discount.toString() : null,
						discountedAmount: discountedAmount.toString(),
						method: "mpesa_stk",
						channel: "staff",
						taxAmount: taxAmount.toString(),
						totalAmount: totalInclusiveTax.toString(),
						externalReference: checkoutRequestId,
						createdByUserId: userId,
						vatType: taxType,
					})
					.returning({ id: payments.id });

				return id;
			});

			return {
				checkoutRequestId,
				merchantRequestId,
				customerMessage: mpesaRes.CustomerMessage,
				responseDescription: mpesaRes.ResponseDescription,
				paymentId,
			};
		},
	);

export const registerUrlCallacksFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async () => {
		await registerUrlCallacks();
		return { success: true };
	});

export const createManualMembershipPaymentFn = createServerFn({
	method: "POST",
})
	.middleware([authMiddleware])
	.inputValidator(paymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");

			const {
				memberId,
				planId,
				paymentDate,
				discountType,
				discount,
				reference,
			} = data;
			const paymentNo = await getPaymentNo();
			const settings = await db.query.settings.findFirst({
				columns: { billing: true },
			});
			const plan = await db.query.membershipPlans.findFirst({
				where: (plans, { eq }) => eq(plans.id, planId),
			});

			if (!plan) {
				throw new Error("Plan not found");
			}

			const discountedAmount = discountCalculator(
				discountType,
				discount ?? 0,
				plan.price,
			);
			const amount = Math.max(0, plan.price - discountedAmount);

			if (amount <= 0) {
				throw new Error("Payment amount must be greater than zero");
			}

			const taxType = settings?.billing?.applyTaxToMembership
				? (settings.billing?.vatType ?? "inclusive")
				: "none";
			const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(
				amount,
				taxType,
			);

			const result = await db.transaction(async (tx) => {
				const [payment] = await tx
					.insert(payments)
					.values({
						paymentDate: new Date(paymentDate),
						amount: plan.price.toString(),
						lineTotal: amountExlusiveTax.toString(),
						memberId,
						planId,
						paymentNo: paymentNo.toString(),
						status: "completed",
						discountType,
						discount: discount ? discount.toString() : null,
						discountedAmount: discountedAmount.toString(),
						method: "mpesa_manual",
						channel: "staff",
						taxAmount: taxAmount.toString(),
						totalAmount: totalInclusiveTax.toString(),
						reference,
						createdByUserId: userId,
						vatType: taxType,
					})
					.returning();

				return finalizeMembershipPayment({
					tx,
					payment,
					reference,
					updatePendingPayment: false,
					activityLog: {
						action: "create receipt",
						description: `Created membership receipt ${paymentNo}.`,
						userId,
					},
				});
			});

			return {
				success: true,
				paymentId: result.paymentId,
				membershipId: result.membershipId,
			};
		},
	);
