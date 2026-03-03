import { addDays } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { memberMemberships, payments } from "@/drizzle/schema";
import {
	currencyFormatter,
	dateFormat,
	internationalizePhoneNumber,
} from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";
import { sendSms } from "@/lib/sms";
import { toTitleCase } from "@/lib/utils";
import { logActivity } from "@/services/activity-logger";
import {
	areJournalValuesBalanced,
	createJournalEntry,
} from "@/services/journal";

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

		const planDetails = await step.run("fetch-plan-details", async () => {
			const plan = await db.query.membershipPlans.findFirst({
				where: (plans, { eq }) => eq(plans.id, fetchedPayment.planId as string),
			});
			if (!plan) {
				throw new Error("Plan not found");
			}

			const membership = await db.query.memberMemberships.findFirst({
				where: (memberships, { eq }) =>
					eq(memberships.memberId, fetchedPayment.memberId),
				orderBy: (memberships, { desc }) => [desc(memberships.endDate)],
			});

			return {
				isSessionBased: plan.isSessionBased,
				startDate: new Date(fetchedPayment.paymentDate),
				endDate: addDays(new Date(fetchedPayment.paymentDate), plan.duration),
				previousPlanId: membership?.membershipPlanId,
			};
		});

		const ledgerDetails = await step.run("fetch-ledger-details", async () => {
			const settings = await db.query.settings.findFirst({
				columns: { billing: true },
			});

			const planId = await db.query.membershipPlans.findFirst({
				columns: { revenueAccountId: true },
				where: (plans, { eq }) => eq(plans.id, fetchedPayment.planId as string),
			});

			const bankId = await db.query.ledgerAccounts.findFirst({
				columns: { id: true },
				where: (accounts, { eq }) =>
					eq(sql`lower(${accounts.name})`, "mpesa wallet"),
			});

			return {
				vatAccountId: settings?.billing?.vatAccountId,
				revenueAccountId: planId?.revenueAccountId as number,
				bankAccountId: bankId?.id ?? 2,
			};
		});

		const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
		const mpesaReceiptNumber = callbackMetadata.find(
			(item: { Name: string; Value: string | number }) =>
				item.Name === "MpesaReceiptNumber",
		)?.Value;

		const updatePayments = await step.run(
			"update-payment-records",
			async () => {
				const payment = await db.transaction(async (tx) => {
					await tx.insert(memberMemberships).values({
						memberId: fetchedPayment.memberId,
						membershipPlanId: fetchedPayment.planId as string,
						startDate: dateFormat(planDetails.startDate),
						endDate: dateFormat(planDetails.endDate),
						autoRenew: false,
						status: "active",
						paymentId: fetchedPayment.id,
						previousMembershipPlanId: planDetails?.previousPlanId,
						priceCharged: fetchedPayment.totalAmount,
					});

					const [{ id: paymentId }] = await tx
						.update(payments)
						.set({
							status: "completed",
							reference: mpesaReceiptNumber?.toString(),
						})
						.where(eq(payments.id, fetchedPayment.id))
						.returning({ id: payments.id });

					const description = `Payment for ${fetchedPayment.paymentNo} - ${mpesaReceiptNumber}`;

					const lines = [
						{
							lineNumber: 1,
							accountId: ledgerDetails.revenueAccountId,
							amount: fetchedPayment.lineTotal,
							dc: "credit" as "credit" | "debit",
							memo: description,
						},
					];

					if (parseFloat(fetchedPayment.taxAmount) > 0) {
						lines.push({
							lineNumber: 2,
							accountId: ledgerDetails.vatAccountId as number,
							amount: fetchedPayment.taxAmount,
							dc: "credit" as "credit" | "debit",
							memo: description,
						});
					}

					lines.push({
						lineNumber: 3,
						accountId: ledgerDetails.bankAccountId as number,
						amount: fetchedPayment.totalAmount,
						dc: "debit" as "credit" | "debit",
						memo: description,
					});

					if (!areJournalValuesBalanced(lines)) {
						throw new Error("Journal values are not balanced");
					}

					await createJournalEntry({
						entry: {
							entryDate: fetchedPayment.paymentDate,
							reference: fetchedPayment.paymentNo,
							source: "plan payment",
							sourceId: fetchedPayment.id,
							description,
						},
						lines,
					});

					await logActivity({
						data: {
							action: "initiate payment",
							description: `Initiated membership payment for payment ${fetchedPayment.paymentNo}.`,
							userId: fetchedPayment.createdByUserId as string,
						},
					});

					return paymentId;
				});

				if (!payment) {
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
