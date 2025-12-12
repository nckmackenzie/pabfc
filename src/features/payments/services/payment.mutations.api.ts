import { createServerFn } from "@tanstack/react-start";
import { db } from "@/drizzle/db";
import { mpesaStkRequests, payments } from "@/drizzle/schema";
import { getPaymentNo } from "@/features/payments/services/payments.queries.api";
import { paymentSchema } from "@/features/payments/services/schemas";
import { getPlan } from "@/features/plans/services/plans.api";
import { AuthorizationError } from "@/lib/error-handling/app-error";
import {
	discountCalculator,
	generateFullPaymentInvoiceNo,
	taxCalculator,
} from "@/lib/helpers";
import { initiateMpesaStkPush } from "@/lib/mpesa";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const initiateStkPushFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(paymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			if (!requirePermission("payments:create")) {
				throw new AuthorizationError(
					"You do not have permission to create a payment",
				);
			}

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

			const plan = await getPlan({ data: planId });

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
