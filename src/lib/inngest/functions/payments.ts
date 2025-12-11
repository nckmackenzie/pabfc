import { addDays } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	journalEntries,
	journalLines,
	memberMemberships,
	payments,
} from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";

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
					eq(sql`lower(${accounts.name})`, "cash at bank"),
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

		await step.run("update-payment-records", async () => {
			return await db.transaction(async (tx) => {
				await tx
					.update(payments)
					.set({
						status: "completed",
						reference: mpesaReceiptNumber?.toString(),
					})
					.where(eq(payments.id, fetchedPayment.id));

				// TODO: GET PREVIOUS MEMBERSHIP
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

				const [{ id: journalEntryId }] = await tx
					.insert(journalEntries)
					.values({
						entryDate: fetchedPayment.paymentDate,
						reference: fetchedPayment.paymentNo,
						source: "plan payment",
						sourceId: fetchedPayment.id,
					})
					.returning({ id: journalEntries.id });

				await tx.insert(journalLines).values({
					lineNumber: 1,
					accountId: ledgerDetails.revenueAccountId,
					journalEntryId,
					amount: fetchedPayment.lineTotal,
					dc: "credit",
				});

				if (parseFloat(fetchedPayment.taxAmount) > 0) {
					await tx.insert(journalLines).values({
						lineNumber: 2,
						accountId: ledgerDetails.vatAccountId as number,
						journalEntryId,
						amount: fetchedPayment.amount,
						dc: "credit",
					});
				}

				await tx.insert(journalLines).values({
					lineNumber: 3,
					accountId: ledgerDetails.bankAccountId as number,
					journalEntryId,
					amount: fetchedPayment.totalAmount,
					dc: "debit",
				});
			});
		});
	},
);
