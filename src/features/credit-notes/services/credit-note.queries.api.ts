import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gt, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { creditNotes, memberMemberships, members } from "@/drizzle/schema";
import {
	checkCreditNoteEligibility,
	computeCreditVatSplit,
} from "@/features/credit-notes/lib/eligibility";
import { getAvailableCreditBalance } from "@/features/credit-notes/lib/fifo";
import { creditNotesSearchValidateSchema } from "@/features/credit-notes/services/schemas";
import { dateFormat } from "@/lib/helpers";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

// Powers the "Apply credit" field in payments-form.tsx once a billing member is
// selected — used by both the membership and addon-only payment paths, so it's
// gated on whichever permission got the staff member to that form.
export const getMemberCreditBalanceFn = createServerFn()
	.middleware([authMiddleware])
	.validator((memberId: string) => memberId)
	.handler(async ({ data: memberId }) => {
		await requireAnyPermission(["receipts:create", "credit-notes:view"]);
		const balance = await getAvailableCreditBalance(db, memberId);
		return { balance };
	});

// Loader/preview for the "Issue Credit Note" form: given a membershipId, runs the
// same eligibility check the mutation re-runs server-side (same pattern as
// getUpgradeContext), so an ineligible membership surfaces its reason up front.
export const getCreditNoteIssuanceContextFn = createServerFn()
	.middleware([authMiddleware])
	.validator((membershipId: string) => membershipId)
	.handler(async ({ data: membershipId }) => {
		await requirePermission("credit-notes:create");

		const eligibility = await checkCreditNoteEligibility(db, membershipId);
		if (!eligibility.success) {
			return { eligible: false as const, reason: eligibility.error.message };
		}

		const { membership, plan, member, payment, dailyRate, unusedDays, suggestedAmount, taxRatio } =
			eligibility.data;
		const { creditSubtotal, creditTax } = computeCreditVatSplit(suggestedAmount, taxRatio);

		return {
			eligible: true as const,
			membership: {
				id: membership.id,
				startDate: membership.startDate,
				endDate: membership.endDate,
				priceCharged: membership.priceCharged,
			},
			plan: { id: plan.id, name: plan.name, duration: plan.duration },
			member: { id: member.id, name: `${member.firstName} ${member.lastName}` },
			payment: { id: payment.id, paymentNo: payment.paymentNo },
			dailyRate,
			unusedDays,
			suggestedAmount,
			suggestedCreditSubtotal: creditSubtotal,
			suggestedCreditTax: creditTax,
		};
	});

// Member picker's dependent "which membership" list for the issuance form: every
// membership row for the member that isn't already terminated and still has time
// left — the same two conditions checkCreditNoteEligibility enforces (a cheap
// pre-filter; the authoritative check is re-run per selection via
// getCreditNoteIssuanceContextFn and again server-side on submit).
export const getCreditableMembershipsFn = createServerFn()
	.middleware([authMiddleware])
	.validator((memberId: string) => memberId)
	.handler(async ({ data: memberId }) => {
		await requirePermission("credit-notes:create");

		const today = dateFormat(new Date());
		const rows = await db.query.memberMemberships.findMany({
			where: and(
				eq(memberMemberships.memberId, memberId),
				ne(memberMemberships.status, "terminated"),
				gt(memberMemberships.endDate, today)
			),
			with: { membershipPlan: { columns: { name: true } } },
			orderBy: (row, { desc }) => [desc(row.startDate)],
		});

		return rows.map((row) => ({
			id: row.id,
			planName: row.membershipPlan.name,
			startDate: row.startDate,
			endDate: row.endDate,
			priceCharged: row.priceCharged,
		}));
	});

export const getCreditNotesFn = createServerFn()
	.middleware([authMiddleware])
	.validator(creditNotesSearchValidateSchema)
	.handler(async ({ data: { q, status } }) => {
		await requirePermission("credit-notes:view");

		return db
			.select({
				id: creditNotes.id,
				creditNoteNo: creditNotes.creditNoteNo,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				amount: creditNotes.amount,
				balanceRemaining: creditNotes.balanceRemaining,
				status: creditNotes.status,
				expiresAt: creditNotes.expiresAt,
				createdAt: creditNotes.createdAt,
			})
			.from(creditNotes)
			.innerJoin(members, eq(creditNotes.memberId, members.id))
			.where(
				and(
					status && status !== "all" ? eq(creditNotes.status, status) : undefined,
					q
						? or(
								ilike(creditNotes.creditNoteNo, `%${q}%`),
								ilike(members.firstName, `%${q}%`),
								ilike(members.lastName, `%${q}%`)
							)
						: undefined
				)
			)
			.orderBy(desc(creditNotes.createdAt));
	});

export const getCreditNoteFn = createServerFn()
	.middleware([authMiddleware])
	.validator((id: string) => id)
	.handler(async ({ data: id }) => {
		await requirePermission("credit-notes:view");

		return db.query.creditNotes.findFirst({
			where: eq(creditNotes.id, id),
			with: {
				member: { columns: { firstName: true, lastName: true, memberNo: true } },
				originalPayment: { columns: { id: true, paymentNo: true } },
				originalMembership: { with: { membershipPlan: { columns: { name: true } } } },
				issuedByUser: { columns: { name: true } },
				redemptions: {
					orderBy: (row, { desc }) => [desc(row.redeemedAt)],
					with: {
						payment: { columns: { id: true, paymentNo: true } },
						addonInvoice: { columns: { id: true, invoiceNo: true } },
					},
				},
			},
		});
	});
