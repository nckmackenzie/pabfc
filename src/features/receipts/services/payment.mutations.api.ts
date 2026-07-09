import { createServerFn } from "@tanstack/react-start";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { memberMemberships, members, mpesaStkRequests, paymentMembers, payments } from "@/drizzle/schema";
import {
	finalizeMembershipPayment,
	type Transaction,
} from "@/features/receipts/services/membership-payment-finalizer";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import { paymentSchema } from "@/features/receipts/services/schemas";
import { computeMembershipEndDate, membershipRangeConflicts } from "@/features/receipts/lib/helpers";
import { discountCalculator, dateFormat, generateFullPaymentInvoiceNo, taxCalculator } from "@/lib/helpers";
import { initiateMpesaStkPush, registerUrlCallacks } from "@/lib/mpesa";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { failure, success, type Result } from "@/lib/result";

async function checkMembershipOverlap({
	tx,
	memberIds,
	startDate,
	endDate,
}: {
	tx: Transaction;
	memberIds: string[];
	startDate: string;
	endDate: string;
}): Promise<Result<void>> {
	for (const memberId of memberIds) {
		const existing = await tx.query.memberMemberships.findMany({
			where: eq(memberMemberships.memberId, memberId),
			columns: { id: true, status: true, startDate: true, endDate: true },
		});
		const conflict = existing.find((m) =>
			membershipRangeConflicts({
				status: m.status,
				existingStart: m.startDate,
				existingEnd: m.endDate,
				newStart: startDate,
				newEnd: endDate,
			})
		);
		if (conflict) {
			return failure({
				type: "ConflictError",
				message: `Selected dates overlap with an existing membership (${conflict.startDate} to ${conflict.endDate ?? "open-ended"}).`,
			});
		}
	}
	return success(undefined);
}

async function lockMemberMembershipCreation(tx: Transaction, memberId: string) {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('member_memberships'), hashtext(${memberId}))`);
}

const stkPaymentSchema = paymentSchema.extend({
	phoneNumber: z
		.string()
		.min(1, { error: "Phone Number is required" })
		.regex(/254\d{9}/, { error: "Invalid phone number" }),
});

export const initiateStkPushFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(stkPaymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");

			const { phoneNumber, memberIds, planId, paymentDate, discountType, discount } = data;
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

			if (plan.memberCount > 1) {
				throw new Error("Group plans must be paid via manual receipt entry, not M-Pesa STK push.");
			}

			const memberId = memberIds[0];
			const discountedAmount = discountCalculator(discountType, discount ?? 0, plan.price);

			const amount = plan.price - discountedAmount;

			const accountReference = generateFullPaymentInvoiceNo(
				paymentNo,
				settings?.billing?.invoicePrefix,
				settings?.billing?.invoiceNumberPadding
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
			const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(amount, taxType);

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
		}
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
	.validator(paymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");

			const { memberIds, planId, paymentDate, startDate, numberOfPeriods, discountType, discount, reference } =
				data;

			const uniqueMemberIds = [...new Set(memberIds)];
			if (uniqueMemberIds.length !== memberIds.length) {
				return failure({
					type: "ApplicationError",
					message: "Duplicate members selected.",
				});
			}

			const paymentNo = await getPaymentNo();
			const settings = await db.query.settings.findFirst({
				columns: { billing: true },
			});
			const plan = await db.query.membershipPlans.findFirst({
				where: (plans, { eq }) => eq(plans.id, planId),
			});

			if (!plan) {
				return failure({ type: "NotFoundError", message: "Plan not found" });
			}

			if (memberIds.length !== plan.memberCount) {
				return failure({
					type: "ApplicationError",
					message: `This plan requires exactly ${plan.memberCount} member(s), but ${memberIds.length} were selected.`,
				});
			}

			const selectedMembers = await db.query.members.findMany({
				columns: { id: true, memberStatus: true },
				where: inArray(members.id, memberIds),
			});
			if (
				selectedMembers.length !== memberIds.length ||
				selectedMembers.some((member) => member.memberStatus !== "active")
			) {
				return failure({
					type: "ApplicationError",
					message: "All selected members must be active.",
				});
			}

			// The first selected member is treated as the billing member — the
			// account holder recorded on payments.memberId.
			const billingMemberId = memberIds[0];

			const baseAmount = plan.price * plan.memberCount * numberOfPeriods;
			const discountedAmount = discountCalculator(discountType, discount ?? 0, baseAmount);
			const amount = Math.max(0, baseAmount - discountedAmount);

			if (amount <= 0) {
				return failure({
					type: "ApplicationError",
					message: "Payment amount must be greater than zero",
				});
			}

			const taxType = settings?.billing?.applyTaxToMembership
				? (settings.billing?.vatType ?? "inclusive")
				: "none";
			const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(amount, taxType);

			const result = await db.transaction(async (tx) => {
				// Acquire per-member advisory locks in a stable (sorted) order so that
				// two concurrent group payments sharing a member can't deadlock each
				// other by locking the same members in opposite orders.
				const sortedMemberIds = [...memberIds].sort();
				for (const memberId of sortedMemberIds) {
					await lockMemberMembershipCreation(tx, memberId);
				}

				const candidateEndDate = dateFormat(
					computeMembershipEndDate(startDate, plan.duration, numberOfPeriods)
				);
				const overlapCheck = await checkMembershipOverlap({
					tx,
					memberIds,
					startDate,
					endDate: candidateEndDate,
				});
				if (!overlapCheck.success) {
					return overlapCheck;
				}

				const [payment] = await tx
					.insert(payments)
					.values({
						paymentDate: new Date(paymentDate),
						amount: baseAmount.toString(),
						numberOfPeriods,
						lineTotal: amountExlusiveTax.toString(),
						memberId: billingMemberId,
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

				await tx.insert(paymentMembers).values(
					memberIds.map((memberId) => ({
						paymentId: payment.id,
						memberId,
					}))
				);

				return finalizeMembershipPayment({
					tx,
					payment,
					memberIds,
					reference,
					updatePendingPayment: false,
					startDate,
					numberOfPeriods,
					activityLog: {
						action: "create receipt",
						description: `Created membership receipt ${paymentNo}.`,
						userId,
					},
				});
			});

			if (!result.success) {
				return result;
			}

			return success(undefined);
		}
	);
