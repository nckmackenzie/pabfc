import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { activityLogs, members, membershipPlans, paymentMembers, payments } from "@/drizzle/schema";
import {
	checkPlanAvailability,
	computeMembershipEndDateForPlan,
} from "@/features/receipts/lib/helpers";
import { planFriendEligibility, planSponsorEligibility } from "@/features/receipts/lib/guest-pass";
import {
	checkGuestFriendIdentitySchema,
	type GuestFriendIdentityStatus,
	issueGuestPassSchema,
} from "@/features/receipts/services/guest-pass.schemas";
import {
	findMembersByIdentity,
	loadMatchedMemberHistory,
	loadSponsorEligibilityInput,
} from "@/features/receipts/services/guest-pass.helpers";
import { finalizeMembershipPayment } from "@/features/receipts/services/membership-payment-finalizer";
import {
	checkMembershipOverlap,
	lockMemberMembershipCreation,
	PaymentTransactionError,
} from "@/features/receipts/services/payment.mutations.api";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import { insertMemberRecord } from "@/features/members/services/member-creation";
import { dateFormat, taxCalculator } from "@/lib/helpers";
import { nairobiToday } from "@/lib/nairobi-time";
import { requirePermission } from "@/lib/permissions/permissions";
import { type AppError, failure, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { enableMemberAccess } from "@/services/member-access";

export const getAvailableGuestPassPlansFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("receipts:guest-pass");
		const today = nairobiToday();
		return db
			.select({
				id: membershipPlans.id,
				name: membershipPlans.name,
				price: membershipPlans.price,
				duration: membershipPlans.duration,
				validFrom: membershipPlans.validFrom,
				validTo: membershipPlans.validTo,
			})
			.from(membershipPlans)
			.where(
				and(
					eq(membershipPlans.isGuestPass, true),
					eq(membershipPlans.active, true),
					or(isNull(membershipPlans.validFrom), lte(membershipPlans.validFrom, today)),
					or(isNull(membershipPlans.validTo), gte(membershipPlans.validTo, today))
				)
			)
			.orderBy(asc(membershipPlans.name));
	});

export const checkGuestFriendIdentityFn = createServerFn()
	.middleware([authMiddleware])
	.validator(checkGuestFriendIdentitySchema)
	.handler(async ({ data }): Promise<GuestFriendIdentityStatus> => {
		await requirePermission("receipts:guest-pass");

		return db.transaction(async (tx) => {
			const matches = await findMembersByIdentity({
				tx,
				contact: data.contact,
				idNumber: data.idNumber,
			});
			const history = await loadMatchedMemberHistory(
				tx,
				matches.map((match) => match.id)
			);
			const plan = planFriendEligibility({ matches, history });

			if (plan.kind === "new") return { status: "new" };
			if (plan.kind === "reuse") {
				const match = matches.find((m) => m.id === plan.memberId);
				return {
					status: "reuse",
					memberNo: plan.memberNo,
					memberName: match?.fullName,
					matchedField: match?.matchedFields[0],
				};
			}
			return {
				status: "blocked",
				matchedField: plan.matchedField,
				memberNo: plan.memberNo,
				memberName: plan.memberName,
			};
		});
	});

// PaymentTransactionError carries a failure Result; build one from a bare error.
const rollback = (error: AppError) => new PaymentTransactionError({ success: false, error });

type PgErrorLike = { code?: string; detail?: string; constraint?: string; cause?: unknown };

// Drizzle wraps driver errors, so the Postgres code may sit on `cause`.
function findUniqueViolation(error: unknown): PgErrorLike | null {
	let current: unknown = error;
	for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
		const candidate = current as PgErrorLike;
		if (candidate.code === "23505") return candidate;
		current = candidate.cause;
	}
	return null;
}

function uniqueViolationMessage(violation: PgErrorLike) {
	const hint = `${violation.constraint ?? ""} ${violation.detail ?? ""}`;
	if (hint.includes("id_number")) {
		return "A member with this ID number already exists.";
	}
	if (hint.includes("contact")) {
		return "A member with this phone number already exists.";
	}
	return "A member with these details already exists.";
}

export const issueGuestPassFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(issueGuestPassSchema)
	.handler(
		async ({
			data: { sponsorMemberId, planId, reference, friend },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:guest-pass");

			try {
				const paymentNo = await getPaymentNo();
				const settings = await db.query.settings.findFirst({
					columns: { billing: true },
				});

				const result = await db.transaction(async (tx) => {
					const today = nairobiToday();

					// 1. Plan
					const plan = await tx.query.membershipPlans.findFirst({
						where: eq(membershipPlans.id, planId),
					});
					if (!plan) {
						throw rollback({ type: "NotFoundError", message: "Plan not found" });
					}
					if (!plan.isGuestPass) {
						throw rollback({ type: "ApplicationError", message: "Selected plan is not a guest pass plan." });
					}
					const availability = checkPlanAvailability({ plan, today });
					if (!availability.success) throw new PaymentTransactionError(availability);

					// 2. Sponsor
					const sponsorResult = planSponsorEligibility(
						await loadSponsorEligibilityInput(tx, sponsorMemberId, today)
					);
					if (!sponsorResult.success) throw new PaymentTransactionError(sponsorResult);

					// 3. Friend identity
					const matches = await findMembersByIdentity({
						tx,
						contact: friend.contact,
						idNumber: friend.idNumber,
					});
					const history = await loadMatchedMemberHistory(
						tx,
						matches.map((match) => match.id)
					);
					const friendPlan = planFriendEligibility({ matches, history });
					if (friendPlan.kind === "conflict") {
						throw rollback(friendPlan.error);
					}

					// 4. Create or reuse the friend. No registration-link SMS either way.
					let friendMemberId: string;
					let friendMemberNo: number;
					if (friendPlan.kind === "new") {
						const created = await insertMemberRecord({
							tx,
							data: {
								firstName: friend.firstName,
								lastName: friend.lastName,
								contact: friend.contact,
								idType: friend.idType,
								idNumber: friend.idNumber,
								gender: friend.gender ?? "unspecified",
								dateOfBirth: friend.dateOfBirth || null,
								email: friend.email || null,
								memberStatus: "active",
							},
						});
						friendMemberId = created.id;
						friendMemberNo = created.memberNo;
					} else {
						friendMemberId = friendPlan.memberId;
						friendMemberNo = friendPlan.memberNo;
						// The voided pass's void disabled access; turn it back on and queue
						// the sync, exactly as member-access does for any re-enable.
						await enableMemberAccess(tx, friendMemberId, "guest_pass_reissued");
					}

					// 5. Serialise membership creation for the friend.
					await lockMemberMembershipCreation(tx, friendMemberId);

					// 6. Dates and overlap
					const startDate = today;
					const endDate = dateFormat(
						computeMembershipEndDateForPlan({ plan, startDate, numberOfPeriods: 1 })
					);
					const overlapCheck = await checkMembershipOverlap({
						tx,
						memberIds: [friendMemberId],
						startDate,
						endDate,
					});
					if (!overlapCheck.success) throw new PaymentTransactionError(overlapCheck);

					// 7. Payment, covered member, membership + journal (via the finalizer).
					const taxType = settings?.billing?.applyTaxToMembership
						? (settings.billing?.vatType ?? "inclusive")
						: "none";
					const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(
						plan.price,
						taxType
					);

					const [payment] = await tx
						.insert(payments)
						.values({
							paymentDate: new Date(),
							amount: plan.price.toString(),
							numberOfPeriods: 1,
							lineTotal: amountExlusiveTax.toString(),
							memberId: friendMemberId,
							sponsorMemberId,
							planId,
							paymentNo: paymentNo.toString(),
							status: "completed",
							discountType: "none",
							discountedAmount: "0",
							method: "mpesa_manual",
							channel: "staff",
							taxAmount: taxAmount.toString(),
							totalAmount: totalInclusiveTax.toString(),
							reference,
							createdByUserId: userId,
							vatType: taxType,
						})
						.returning();

					await tx.insert(paymentMembers).values({
						paymentId: payment.id,
						memberId: friendMemberId,
					});

					// No appliedCreditAmount: the finalizer only touches credit notes when
					// one is passed, so guest passes never redeem credit.
					const finalizeResult = await finalizeMembershipPayment({
						tx,
						payment,
						memberIds: [friendMemberId],
						reference,
						updatePendingPayment: false,
						startDate,
						numberOfPeriods: 1,
					});
					if (!finalizeResult.success) throw new PaymentTransactionError(finalizeResult);

					// 8. Audit trail
					const sponsor = await tx.query.members.findFirst({
						where: eq(members.id, sponsorMemberId),
						columns: { firstName: true, lastName: true, memberNo: true },
					});
					await tx.insert(activityLogs).values({
						userId,
						action: "issue guest pass",
						description: `Issued guest pass ${paymentNo} (${plan.name}) for ${friend.firstName} ${friend.lastName} (member no. ${friendMemberNo}), sponsored by ${sponsor?.firstName ?? ""} ${sponsor?.lastName ?? ""} (member no. ${sponsor?.memberNo ?? "?"}).`,
					});

					return { paymentId: payment.id, friendMemberId, friendMemberNo };
				});

				return success(result);
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				const violation = findUniqueViolation(error);
				if (violation) {
					return failure({ type: "ConflictError", message: uniqueViolationMessage(violation) });
				}
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);
