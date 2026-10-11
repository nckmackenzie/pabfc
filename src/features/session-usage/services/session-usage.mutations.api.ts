import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { activityLogs, memberMemberships, membershipSessionUsage } from "@/drizzle/schema";
import { lockMemberMembershipCreation } from "@/features/receipts/services/payment.mutations.api";
import { reconcileOneMembership } from "@/features/session-usage/services/reconcile";
import {
	addSessionUsageSchema,
	waiveSessionUsageSchema,
} from "@/features/session-usage/services/schemas";
import { nairobiToday } from "@/lib/nairobi-time";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";

// Mirrors PaymentTransactionError's purpose (see payment.mutations.api.ts):
// returning a failure from inside db.transaction's callback would still let
// Drizzle commit any writes already made before the check — throwing rolls
// them back instead.
class SessionUsageTransactionError extends Error {
	constructor(readonly result: Extract<Result<never>, { success: false }>) {
		super("session usage transaction rolled back");
	}
}

export const addSessionUsageFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(addSessionUsageSchema)
	.handler(
		async ({
			data: { membershipId, usageDate, reason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("attendance:adjust-sessions");

			const fail = (error: Parameters<typeof failure>[0]) =>
				new SessionUsageTransactionError({ success: false, error });

			try {
				return await db.transaction(async (tx) => {
					const membership = await tx.query.memberMemberships.findFirst({
						where: eq(memberMemberships.id, membershipId),
					});
					if (!membership) {
						throw fail({ type: "NotFoundError", message: "Membership not found" });
					}
					if (membership.sessionsTotal === null) {
						throw fail({
							type: "ApplicationError",
							message: "This membership is not session-based.",
						});
					}

					await lockMemberMembershipCreation(tx, membership.memberId);

					const windowEnd = membership.originalEndDate ?? membership.endDate;
					if (!windowEnd || usageDate < membership.startDate || usageDate > windowEnd) {
						throw fail({
							type: "ApplicationError",
							message: `Usage date must be between ${membership.startDate} and ${windowEnd ?? "the membership's end date"}.`,
						});
					}
					const today = nairobiToday();
					if (usageDate > today) {
						throw fail({
							type: "ApplicationError",
							message: "Cannot add a session for a future date.",
						});
					}

					const existingUsageRows = await tx
						.select({ id: membershipSessionUsage.id, voidedAt: membershipSessionUsage.voidedAt })
						.from(membershipSessionUsage)
						.where(eq(membershipSessionUsage.membershipId, membershipId));
					const usedCount = existingUsageRows.filter((row) => row.voidedAt === null).length;
					if (usedCount >= membership.sessionsTotal) {
						throw fail({
							type: "ApplicationError",
							message: "This membership has no remaining sessions to add.",
						});
					}

					const existingForDate = await tx.query.membershipSessionUsage.findFirst({
						where: and(
							eq(membershipSessionUsage.membershipId, membershipId),
							eq(membershipSessionUsage.usageDate, usageDate)
						),
					});

					if (existingForDate) {
						if (existingForDate.voidedAt === null) {
							throw fail({
								type: "ConflictError",
								message: "A session is already recorded for this date.",
							});
						}
						await tx
							.update(membershipSessionUsage)
							.set({ voidedAt: null, voidedByUserId: null, voidReason: null, reason })
							.where(eq(membershipSessionUsage.id, existingForDate.id));
					} else {
						await tx.insert(membershipSessionUsage).values({
							membershipId,
							memberId: membership.memberId,
							usageDate,
							source: "manual",
							reason,
							createdByUserId: userId,
						});
					}

					await reconcileOneMembership(tx, membershipId, { actorUserId: userId });

					await tx.insert(activityLogs).values({
						userId,
						action: "add session usage",
						description: `Added a manual session for membership ${membershipId} on ${usageDate}. Reason: ${reason}.`,
					});

					return success(undefined);
				});
			} catch (error) {
				if (error instanceof SessionUsageTransactionError) return error.result;
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to add session usage" });
			}
		}
	);

export const waiveSessionUsageFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(waiveSessionUsageSchema)
	.handler(
		async ({
			data: { usageId, reason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("attendance:adjust-sessions");

			const fail = (error: Parameters<typeof failure>[0]) =>
				new SessionUsageTransactionError({ success: false, error });

			try {
				return await db.transaction(async (tx) => {
					const usage = await tx.query.membershipSessionUsage.findFirst({
						where: eq(membershipSessionUsage.id, usageId),
					});
					if (!usage) {
						throw fail({ type: "NotFoundError", message: "Session usage record not found" });
					}
					if (usage.voidedAt !== null) {
						throw fail({
							type: "ApplicationError",
							message: "This session has already been waived.",
						});
					}

					await lockMemberMembershipCreation(tx, usage.memberId);

					const now = new Date();
					await tx
						.update(membershipSessionUsage)
						.set({ voidedAt: now, voidedByUserId: userId, voidReason: reason })
						.where(eq(membershipSessionUsage.id, usageId));

					await reconcileOneMembership(tx, usage.membershipId, { actorUserId: userId, now });

					await tx.insert(activityLogs).values({
						userId,
						action: "waive session usage",
						description: `Waived the session for membership ${usage.membershipId} on ${usage.usageDate}. Reason: ${reason}.`,
					});

					return success(undefined);
				});
			} catch (error) {
				if (error instanceof SessionUsageTransactionError) return error.result;
				console.error(error);
				return failure({ type: "ApplicationError", message: "Failed to waive session usage" });
			}
		}
	);
