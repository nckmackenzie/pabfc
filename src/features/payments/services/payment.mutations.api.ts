import { createServerFn } from "@tanstack/react-start";
import { db } from "@/drizzle/db";
import { mpesaStkRequests } from "@/drizzle/schema";
import { paymentSchema } from "@/features/payments/services/schemas";
import { AuthorizationError } from "@/lib/error-handling/app-error";
import { initiateMpesaStkPush } from "@/lib/mpesa";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const initiateStkPushFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(paymentSchema)
	.handler(async ({ data }) => {
		if (!requirePermission("payments:create")) {
			throw new AuthorizationError(
				"You do not have permission to create a payment",
			);
		}

		const { amount, phoneNumber, memberId, planId, paymentDate } = data;

		const mpesaRes = await initiateMpesaStkPush({
			amount,
			phoneNumber,
			accountReference: "Membership Plan",
			transactionDesc: "Membership Plan Payment",
		});

		const checkoutRequestId = mpesaRes.CheckoutRequestID;
		const merchantRequestId = mpesaRes.MerchantRequestID;

		await db.insert(mpesaStkRequests).values({
			memberId,
			amount: amount.toString(),
			initiatedChannel: "staff",
			phoneNumber,
			checkoutRequestId,
			merchantRequestId,
			status: "pending",
		});

		return {
			checkoutRequestId,
			merchantRequestId,
			customerMessage: mpesaRes.CustomerMessage,
			responseDescription: mpesaRes.ResponseDescription,
		};
	});
