import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	activityLogs,
	complimentaryMembershipRequests,
	memberMemberships,
	members,
	membershipPlans,
	paymentMembers,
	payments,
} from "@/drizzle/schema";
import {
	notifyComplimentaryRequestDecision,
	notifyComplimentaryRequestSubmitted,
} from "@/features/receipts/lib/complimentary-notifications";
import { computeMembershipEndDate } from "@/features/receipts/lib/helpers";
import {
	checkMembershipOverlap,
	lockMemberMembershipCreation,
	PaymentTransactionError,
} from "@/features/receipts/services/payment.mutations.api";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import {
	complimentaryRequestSchema,
	rejectComplimentaryRequestSchema,
} from "@/features/receipts/services/complimentary.schemas";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const requestComplimentaryMembershipFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(complimentaryRequestSchema)
	.handler(
		async ({
			data: { memberId, planId, startDate, numberOfPeriods, reason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:complimentary-request");

			const member = await db.query.members.findFirst({
				where: eq(members.id, memberId),
				columns: { id: true, memberStatus: true },
			});
			if (!member || member.memberStatus !== "active") {
				return failure({ type: "ApplicationError", message: "Member must be active." });
			}

			const plan = await db.query.membershipPlans.findFirst({
				where: eq(membershipPlans.id, planId),
			});
			if (!plan || !plan.active) {
				return failure({ type: "NotFoundError", message: "Plan not found or inactive." });
			}
			if (plan.memberCount !== 1) {
				return failure({
					type: "ApplicationError",
					message: "Only single-member plans are eligible for complimentary membership.",
				});
			}

			const candidateEndDate = dateFormat(
				computeMembershipEndDate(startDate, plan.duration, numberOfPeriods)
			);

			try {
				const result = await db.transaction(async (tx) => {
					const overlapCheck = await checkMembershipOverlap({
						tx,
						memberIds: [memberId],
						startDate,
						endDate: candidateEndDate,
					});
					if (!overlapCheck.success) {
						throw new PaymentTransactionError(overlapCheck);
					}

					const [request] = await tx
						.insert(complimentaryMembershipRequests)
						.values({
							memberId,
							planId,
							startDate,
							numberOfPeriods,
							reason,
							status: "pending",
							requestedByUserId: userId,
						})
						.returning();

					await tx.insert(activityLogs).values({
						userId,
						action: "request complimentary membership",
						description: `Requested complimentary membership on plan ${plan.name} for member ${memberId}.`,
					});

					return success(request);
				});

				if (result.success) {
					notifyComplimentaryRequestSubmitted(result.data).catch((error) => console.log(error));
				}

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

export const approveComplimentaryRequestFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((requestId: string) => requestId)
	.handler(
		async ({
			data: requestId,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:complimentary-approve");

			// Same workaround as upgradePaymentFn's `fail` helper: `failure(...)` returns
			// the general `Result<never>` union, which TS won't narrow to the
			// `{ success: false }` branch `PaymentTransactionError` requires unless it's
			// first assigned to a variable and checked with `if (!x.success)`. Building the
			// object literal directly with a `success: false` literal sidesteps that.
			const fail = (error: Parameters<typeof failure>[0]) =>
				new PaymentTransactionError({ success: false, error });

			try {
				const result = await db.transaction(async (tx) => {
					const request = await tx.query.complimentaryMembershipRequests.findFirst({
						where: eq(complimentaryMembershipRequests.id, requestId),
					});
					if (!request) {
						throw fail({ type: "NotFoundError", message: "Complimentary request not found." });
					}
					if (request.status !== "pending") {
						throw fail({
							type: "ConflictError",
							message: `This request has already been ${request.status}.`,
						});
					}

					await lockMemberMembershipCreation(tx, request.memberId);

					const member = await tx.query.members.findFirst({
						where: eq(members.id, request.memberId),
						columns: { id: true, memberStatus: true },
					});
					if (!member || member.memberStatus !== "active") {
						throw fail({ type: "ApplicationError", message: "Member is no longer active." });
					}

					const plan = await tx.query.membershipPlans.findFirst({
						where: eq(membershipPlans.id, request.planId),
					});
					if (!plan || !plan.active) {
						throw fail({ type: "NotFoundError", message: "Plan is no longer active." });
					}

					const candidateEndDate = dateFormat(
						computeMembershipEndDate(request.startDate, plan.duration, request.numberOfPeriods)
					);
					const overlapCheck = await checkMembershipOverlap({
						tx,
						memberIds: [request.memberId],
						startDate: request.startDate,
						endDate: candidateEndDate,
					});
					if (!overlapCheck.success) {
						throw new PaymentTransactionError(overlapCheck);
					}

					const paymentNo = await getPaymentNo();

					const [payment] = await tx
						.insert(payments)
						.values({
							paymentDate: new Date(),
							memberId: request.memberId,
							planId: request.planId,
							paymentNo: paymentNo.toString(),
							amount: "0",
							numberOfPeriods: request.numberOfPeriods,
							discountType: "none",
							discountedAmount: "0",
							lineTotal: "0",
							taxAmount: "0",
							totalAmount: "0",
							status: "completed",
							method: "complimentary",
							channel: "staff",
							createdByUserId: request.requestedByUserId,
						})
						.returning();

					await tx.insert(paymentMembers).values({
						paymentId: payment.id,
						memberId: request.memberId,
					});

					const today = dateFormat(new Date());
					const membershipStatus = request.startDate > today ? "pending" : "active";
					const endDate = computeMembershipEndDate(
						request.startDate,
						plan.duration,
						request.numberOfPeriods
					);

					const mostRecentMembership = await tx.query.memberMemberships.findFirst({
						where: eq(memberMemberships.memberId, request.memberId),
						orderBy: (memberships, { desc }) => [desc(memberships.endDate)],
						columns: { membershipPlanId: true },
					});

					await tx.insert(memberMemberships).values({
						memberId: request.memberId,
						membershipPlanId: request.planId,
						startDate: dateFormat(request.startDate),
						endDate: dateFormat(endDate),
						autoRenew: false,
						status: membershipStatus,
						paymentId: payment.id,
						previousMembershipPlanId: mostRecentMembership?.membershipPlanId,
						priceCharged: "0.00",
					});

					const [updatedRequest] = await tx
						.update(complimentaryMembershipRequests)
						.set({
							status: "approved",
							reviewedByUserId: userId,
							reviewedAt: new Date(),
							resultingPaymentId: payment.id,
						})
						.where(eq(complimentaryMembershipRequests.id, request.id))
						.returning();

					await tx.insert(activityLogs).values({
						userId,
						action: "approve complimentary membership",
						description: `Approved complimentary membership request for member ${request.memberId}, creating payment ${paymentNo}.`,
					});

					return success(updatedRequest);
				});

				if (result.success) {
					notifyComplimentaryRequestDecision(result.data).catch((error) => console.log(error));
				}

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

export const rejectComplimentaryRequestFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(rejectComplimentaryRequestSchema)
	.handler(
		async ({
			data: { requestId, rejectionReason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:complimentary-approve");

			// Same workaround as upgradePaymentFn's `fail` helper — see the comment in
			// approveComplimentaryRequestFn above for why `failure(...)` can't be passed
			// inline here.
			const fail = (error: Parameters<typeof failure>[0]) =>
				new PaymentTransactionError({ success: false, error });

			try {
				const result = await db.transaction(async (tx) => {
					const request = await tx.query.complimentaryMembershipRequests.findFirst({
						where: eq(complimentaryMembershipRequests.id, requestId),
					});
					if (!request) {
						throw fail({ type: "NotFoundError", message: "Complimentary request not found." });
					}
					if (request.status !== "pending") {
						throw fail({
							type: "ConflictError",
							message: `This request has already been ${request.status}.`,
						});
					}

					const [updatedRequest] = await tx
						.update(complimentaryMembershipRequests)
						.set({
							status: "rejected",
							reviewedByUserId: userId,
							reviewedAt: new Date(),
							rejectionReason,
						})
						.where(eq(complimentaryMembershipRequests.id, request.id))
						.returning();

					await tx.insert(activityLogs).values({
						userId,
						action: "reject complimentary membership",
						description: `Rejected complimentary membership request for member ${request.memberId}. Reason: ${rejectionReason}.`,
					});

					return success(updatedRequest);
				});

				if (result.success) {
					notifyComplimentaryRequestDecision(result.data).catch((error) => console.log(error));
				}

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);
