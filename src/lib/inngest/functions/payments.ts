import { db } from "@/drizzle/db";
import { finalizeMembershipPayment } from "@/features/receipts/services/membership-payment-finalizer";
import { currencyFormatter, internationalizePhoneNumber } from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";
import { sendSms } from "@/lib/sms";
import { toTitleCase } from "@/lib/utils";

export const createPayment = inngest.createFunction(
	{ id: "create-payment" },
	{ event: "app/payments.create" },
	async ({ event, step }) => {
		const {
			data: { checkoutRequestId, stkCallback },
		} = event;
		const fetchedPayment = await step.run("fetch-records", async () => {
			const payment = await db.query.payments.findFirst({
				where: (payments, { eq, and }) =>
					and(
						eq(payments.externalReference, checkoutRequestId),
						eq(payments.status, "pending"),
					),
			});
			if (!payment) {
				throw new Error("Payment request not found");
			}
			return payment;
		});

		const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
		const mpesaReceiptNumber = callbackMetadata.find(
			(item: { Name: string; Value: string | number }) =>
				item.Name === "MpesaReceiptNumber",
		)?.Value;

		const updatePayments = await step.run(
			"update-payment-records",
			async () => {
				const result = await db.transaction(async (tx) => {
					return finalizeMembershipPayment({
						tx,
						payment: fetchedPayment,
						reference: mpesaReceiptNumber?.toString(),
						activityLog: fetchedPayment.createdByUserId
							? {
									action: "initiate payment",
									description: `Initiated membership payment for payment ${fetchedPayment.paymentNo}.`,
									userId: fetchedPayment.createdByUserId,
								}
							: undefined,
					});
				});

				if (!result.paymentId) {
					return { success: false, error: "Something went wrong" };
				}

				return { success: true, error: null };
			},
		);

		await step.run("send-sms", async () => {
			if (!updatePayments.success) return;

			const member = await db.query.members.findFirst({
				columns: { firstName: true, contact: true },
				where: (members, { eq }) => eq(members.id, fetchedPayment.memberId),
			});

			if (!member) {
				return { success: false, error: "Member not found" };
			}

			const message = `Dear ${toTitleCase(member.firstName)}, your payment of ${currencyFormatter(fetchedPayment.totalAmount)} has been completed successfully.We're glad you're continuing with us`;
			await sendSms({
				to: [internationalizePhoneNumber(member.contact as string, true)],
				message,
			});
		});
	},
);
