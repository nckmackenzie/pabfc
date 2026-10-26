import type { MemberStatus, MembershipStatus } from "@/drizzle/schema";
import { canReceiveMembership } from "@/features/receipts/lib/helpers";
import { type AppError, failure, type Result, success } from "@/lib/result";

// Returns every equivalent form a Kenyan mobile number may be stored in
// (07…, +254…, 254…, 7…) so a lookup matches however it was originally typed.
// Empty or unparseable input yields [].
export function kenyanPhoneVariants(input: string): string[] {
	const cleaned = input.replace(/[\s-]/g, "");
	if (!cleaned) return [];

	const digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
	if (!/^\d+$/.test(digits)) return [];

	let national: string;
	if (digits.startsWith("254") && digits.length === 12) {
		national = digits.slice(3);
	} else if (digits.startsWith("0") && digits.length === 10) {
		national = digits.slice(1);
	} else if (digits.length === 9) {
		national = digits;
	} else {
		return [];
	}

	if (!/^[17]/.test(national)) return [];
	return [`0${national}`, `+254${national}`, `254${national}`, national];
}

export type SponsorEligibilityInput = {
	member: { memberStatus: MemberStatus; deletedAt: Date | null } | null;
	memberships: {
		status: MembershipStatus;
		startDate: string;
		endDate: string | null;
		isGuestPass: boolean;
	}[];
	today: string;
};

// A sponsor must be an active, non-deleted member currently holding a
// non-guest-pass membership. Complimentary and session memberships qualify.
export function planSponsorEligibility({
	member,
	memberships,
	today,
}: SponsorEligibilityInput): Result<void> {
	if (!member || member.deletedAt) {
		return failure({ type: "NotFoundError", message: "Sponsor member not found." });
	}
	if (member.memberStatus !== "active") {
		return failure({
			type: "ApplicationError",
			message: "The sponsor is not an active member.",
		});
	}

	const current = memberships.filter(
		(m) => m.status === "active" && m.startDate <= today && (m.endDate === null || m.endDate >= today)
	);
	if (current.length === 0) {
		return failure({
			type: "ApplicationError",
			message: "The sponsor has no active membership today.",
		});
	}
	if (current.every((m) => m.isGuestPass)) {
		return failure({
			type: "ApplicationError",
			message: "A guest pass cannot sponsor another guest pass — the sponsor needs a regular membership.",
		});
	}
	return success(undefined);
}

export type IdentityField = "phone" | "idNumber";

export type IdentityMatch = {
	id: string;
	memberNo: number;
	fullName: string;
	matchedFields: IdentityField[];
	deletedAt: Date | null;
	memberStatus: MemberStatus;
};

export type MatchedMemberHistory = {
	memberId: string;
	membershipCount: number;
	payments: { status: string; sponsorMemberId: string | null }[];
};

export type FriendEligibility =
	| { kind: "new" }
	| { kind: "reuse"; memberId: string; memberNo: number }
	| {
			kind: "conflict";
			error: Extract<AppError, { type: "ConflictError" }>;
			matchedField: IdentityField;
			memberNo: number;
			memberName: string;
	  };

const FIELD_LABEL: Record<IdentityField, string> = {
	phone: "phone number",
	idNumber: "ID number",
};

function conflict(match: IdentityMatch, detail: string): FriendEligibility {
	const matchedField = match.matchedFields[0];
	return {
		kind: "conflict",
		error: {
			type: "ConflictError",
			message: `A member with this ${FIELD_LABEL[matchedField]} already exists (member no. ${match.memberNo}). ${detail}`,
		},
		matchedField,
		memberNo: match.memberNo,
		memberName: match.fullName,
	};
}

// A guest must be brand new. The only exception is a member left over from a
// voided guest pass: no memberships, and every payment they appear on was a
// voided guest pass. Anything else (including soft-deleted members) blocks.
export function planFriendEligibility({
	matches,
	history,
}: {
	matches: IdentityMatch[];
	history: MatchedMemberHistory[];
}): FriendEligibility {
	if (matches.length === 0) return { kind: "new" };

	const [first] = matches;
	if (new Set(matches.map((m) => m.id)).size > 1) {
		return conflict(first, "The phone number and ID number belong to different members.");
	}
	if (first.deletedAt) {
		return conflict(first, "That record was deleted but cannot be reused.");
	}

	const memberHistory = history.find((h) => h.memberId === first.id);
	// No payments at all means a regular registration, not a voided guest pass.
	const reusable =
		!!memberHistory &&
		memberHistory.membershipCount === 0 &&
		memberHistory.payments.length > 0 &&
		memberHistory.payments.every((p) => p.status === "voided" && p.sponsorMemberId !== null);
	if (!reusable) {
		return conflict(first, "Guest passes are only for people who are not yet members.");
	}
	if (!canReceiveMembership(first)) {
		return conflict(first, "That member is frozen or terminated and cannot receive a pass.");
	}
	return { kind: "reuse", memberId: first.id, memberNo: first.memberNo };
}

export type GuestPassFormField = "sponsorMemberId" | "friend.contact" | "friend.idNumber";

// Best-effort mapping of a server failure message onto the form field it is
// about, so it can be shown inline. Anything unrecognised stays form-level.
export function mapGuestPassErrorToField(message: string): GuestPassFormField | null {
	const lower = message.toLowerCase();
	if (lower.includes("sponsor")) return "sponsorMemberId";
	if (lower.includes("phone number")) return "friend.contact";
	if (lower.includes("id number")) return "friend.idNumber";
	return null;
}
