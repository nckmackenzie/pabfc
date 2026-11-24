import { and, asc, desc, eq, exists, inArray, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { activityLogs, enquiries, members, paymentMembers, payments } from "@/drizzle/schema";
import { canSystemTransition } from "@/features/enquiries/lib/enquiry-status";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import { openEnquiryByPhoneFilter } from "@/features/enquiries/lib/query-filters";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

// ─── Queries ────────────────────────────────────────────────────────────────

const qb = new QueryBuilder();

// A completed, non-complimentary payment that covers `memberId`, other than the
// one being finalised. Complimentary and voided payments never count as "paid".
//
// Coverage is paymentMembers OR, for payments with no paymentMembers rows at
// all, the billing member. The second branch is needed because the M-Pesa STK
// path never writes paymentMembers rows. payments.memberId alone would be wrong
// for group payments, so it is only trusted when no covered-member rows exist.
export function paidPaymentCoveringMemberFilter({
	memberId,
	excludePaymentId,
}: {
	memberId: string;
	excludePaymentId: string;
}) {
	const coversViaMembers = qb
		.select({ id: paymentMembers.id })
		.from(paymentMembers)
		.where(and(eq(paymentMembers.paymentId, payments.id), eq(paymentMembers.memberId, memberId)));
	const hasAnyCoveredMembers = qb
		.select({ id: paymentMembers.id })
		.from(paymentMembers)
		.where(eq(paymentMembers.paymentId, payments.id));

	return and(
		eq(payments.status, "completed"),
		ne(payments.method, "complimentary"),
		ne(payments.id, excludePaymentId),
		or(
			exists(coversViaMembers),
			and(eq(payments.memberId, memberId), notExists(hasAnyCoveredMembers))
		)
	);
}

// Open enquiries whose phone matches the member's contact in any stored format,
// newest first: the fallback link for members registered without "Convert".
export const fallbackCandidateFilter = (contact: string) => openEnquiryByPhoneFilter(contact);
export const fallbackCandidateOrder = desc(enquiries.createdAt);

// Enquiries linked to a member that are still awaiting their payment.
export function registeredEnquiriesForMemberFilter(memberId: string) {
	return and(
		eq(enquiries.convertedMemberId, memberId),
		eq(enquiries.status, "registered"),
		isNull(enquiries.deletedAt)
	);
}

// ─── Planner ────────────────────────────────────────────────────────────────

export type ConversionEnquiry = { id: string; createdAt: Date };

export type ConversionMemberInput = {
	memberId: string;
	// Completed, non-complimentary payments before the one being finalised.
	priorPaidPaymentCount: number;
	// Enquiries already linked to this member (status registered).
	registeredEnquiries: ConversionEnquiry[];
	// Open enquiries matching the member's phone; only consulted for first payments.
	fallbackCandidates: ConversionEnquiry[];
};

export type PlannedConversion = {
	enquiryId: string;
	memberId: string;
	// "registered": the enquiry was linked to this member (Convert / Link).
	// "fallback": matched by phone; registeredAt stays null (a direct registration).
	via: "registered" | "fallback";
};

// Decides which enquiries a paid membership payment converts, per covered member:
// - a linked `registered` enquiry converts on ANY paid payment, so a lapsed
//   member linked later still converts on their next payment;
// - otherwise, only on the member's FIRST paid payment, the most recent open
//   enquiry matching their phone is converted directly.
export function planEnquiryConversions(inputs: ConversionMemberInput[]): PlannedConversion[] {
	const planned: PlannedConversion[] = [];
	const taken = new Set<string>();

	for (const input of inputs) {
		const registered = input.registeredEnquiries.filter(({ id }) => !taken.has(id));
		if (input.registeredEnquiries.length > 0) {
			for (const { id } of registered) {
				taken.add(id);
				planned.push({ enquiryId: id, memberId: input.memberId, via: "registered" });
			}
			continue;
		}

		if (input.priorPaidPaymentCount > 0) continue;

		const [latest] = input.fallbackCandidates
			.filter(({ id }) => !taken.has(id))
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		if (latest) {
			taken.add(latest.id);
			planned.push({ enquiryId: latest.id, memberId: input.memberId, via: "fallback" });
		}
	}

	return planned;
}

// A voided conversion payment puts the enquiry back to awaiting its first
// payment. The member link is kept; registeredAt falls back to convertedAt so
// directly-registered (fallback) enquiries still have a registration date.
export function planVoidReversal(enquiry: { registeredAt: Date | null; convertedAt: Date | null }) {
	return {
		status: "registered" as const,
		convertedPaymentId: null,
		convertedAt: null,
		registeredAt: enquiry.registeredAt ?? enquiry.convertedAt,
	};
}

// ─── DB wrappers ────────────────────────────────────────────────────────────

type ConversionPayment = {
	id: string;
	paymentNo: string;
	paymentDate: Date | string;
	createdByUserId: string | null;
};

async function loadConversionInputs(tx: Transaction, memberIds: string[], paymentId: string) {
	const memberRows = await tx
		.select({ id: members.id, contact: members.contact })
		.from(members)
		.where(inArray(members.id, memberIds));

	const inputs: ConversionMemberInput[] = [];
	const names = new Map<string, string>();

	for (const member of memberRows) {
		const registered = await tx
			.select({
				id: enquiries.id,
				createdAt: enquiries.createdAt,
				firstName: enquiries.firstName,
				lastName: enquiries.lastName,
			})
			.from(enquiries)
			.where(registeredEnquiriesForMemberFilter(member.id));

		let priorPaidPaymentCount = 0;
		let candidates: typeof registered = [];

		// The fallback only applies to a first payment with no linked enquiry, so
		// skip those queries when a linked enquiry already decides the outcome.
		if (registered.length === 0) {
			const [{ count }] = await tx
				.select({ count: sql<number>`count(*)::int` })
				.from(payments)
				.where(
					paidPaymentCoveringMemberFilter({ memberId: member.id, excludePaymentId: paymentId })
				);
			priorPaidPaymentCount = count;

			const filter = fallbackCandidateFilter(member.contact);
			if (count === 0 && filter) {
				candidates = await tx
					.select({
						id: enquiries.id,
						createdAt: enquiries.createdAt,
						firstName: enquiries.firstName,
						lastName: enquiries.lastName,
					})
					.from(enquiries)
					.where(filter)
					.orderBy(fallbackCandidateOrder, asc(enquiries.id));
			}
		}

		for (const row of [...registered, ...candidates]) {
			names.set(row.id, enquiryFullName(row.firstName, row.lastName));
		}
		inputs.push({
			memberId: member.id,
			priorPaidPaymentCount,
			registeredEnquiries: registered,
			fallbackCandidates: candidates,
		});
	}

	return { inputs, names };
}

/**
 * Marks enquiries converted by a just-completed membership payment. Call from
 * finalizeMembershipPayment once the payment is `completed`.
 *
 * Runs in a savepoint and never throws: a failure here is logged and only the
 * savepoint is rolled back, so it can never stop the payment from committing.
 */
export async function markEnquiryConversions({
	tx,
	payment,
	memberIds,
}: {
	tx: Transaction;
	payment: ConversionPayment;
	memberIds: string[];
}) {
	try {
		await tx.transaction(async (savepoint) => {
			const { inputs, names } = await loadConversionInputs(savepoint, memberIds, payment.id);
			const planned = planEnquiryConversions(inputs);

			for (const { enquiryId, memberId, via } of planned) {
				const [updated] = await savepoint
					.update(enquiries)
					.set({
						status: "converted",
						convertedMemberId: memberId,
						convertedPaymentId: payment.id,
						convertedAt: new Date(payment.paymentDate),
					})
					.where(
						and(
							eq(enquiries.id, enquiryId),
							isNull(enquiries.deletedAt),
							inArray(enquiries.status, ["new", "contacted", "registered"])
						)
					)
					.returning({ id: enquiries.id });
				if (!updated || !payment.createdByUserId) continue;

				await savepoint.insert(activityLogs).values({
					userId: payment.createdByUserId,
					action: "convert enquiry",
					description: `Enquiry for ${names.get(enquiryId) ?? enquiryId} converted by receipt ${payment.paymentNo}${via === "fallback" ? " (matched by phone)" : ""}`,
				});
			}
		});
	} catch (error) {
		console.error("Failed to mark enquiry conversions; payment is unaffected", error);
	}
}

/**
 * Reverts conversions that rested on a payment being voided. Call inside
 * voidPaymentFn's transaction. Savepointed and non-throwing, like the hook.
 */
export async function revertEnquiryConversionsForVoid({
	tx,
	paymentId,
	userId,
}: {
	tx: Transaction;
	paymentId: string;
	userId: string;
}) {
	try {
		await tx.transaction(async (savepoint) => {
			const converted = await savepoint
				.select()
				.from(enquiries)
				.where(and(eq(enquiries.convertedPaymentId, paymentId), eq(enquiries.status, "converted")))
				.for("update");

			for (const enquiry of converted) {
				if (!canSystemTransition(enquiry.status, "registered")) continue;

				await savepoint
					.update(enquiries)
					.set({ ...planVoidReversal(enquiry), updatedByUserId: userId })
					.where(eq(enquiries.id, enquiry.id));

				await savepoint.insert(activityLogs).values({
					userId,
					action: "revert enquiry conversion",
					description: `Enquiry for ${enquiryFullName(enquiry.firstName, enquiry.lastName)} is awaiting payment again because its conversion receipt was voided`,
				});
			}
		});
	} catch (error) {
		console.error("Failed to revert enquiry conversions; void is unaffected", error);
	}
}
