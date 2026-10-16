import { describe, expect, it } from "vitest";
import {
	type IdentityMatch,
	kenyanPhoneVariants,
	mapGuestPassErrorToField,
	type MatchedMemberHistory,
	planFriendEligibility,
	planSponsorEligibility,
	type SponsorEligibilityInput,
} from "./guest-pass";

describe("kenyanPhoneVariants", () => {
	const expected = ["0712345678", "+254712345678", "254712345678", "712345678"];

	it.each(["0712345678", "+254712345678", "254712345678", "712345678"])(
		"returns every form for %s",
		(input) => {
			expect([...kenyanPhoneVariants(input)].sort()).toEqual([...expected].sort());
		}
	);

	it("strips spaces and dashes", () => {
		expect([...kenyanPhoneVariants("+254 712-345 678")].sort()).toEqual([...expected].sort());
	});

	it("returns [] for empty or unparseable input", () => {
		expect(kenyanPhoneVariants("")).toEqual([]);
		expect(kenyanPhoneVariants("  - ")).toEqual([]);
		expect(kenyanPhoneVariants("abc")).toEqual([]);
		expect(kenyanPhoneVariants("12345")).toEqual([]);
	});
});

describe("planSponsorEligibility", () => {
	const today = "2026-10-16";
	const active = { memberStatus: "active" as const, deletedAt: null };
	const regular = { status: "active" as const, startDate: "2026-10-01", endDate: "2026-10-31", isGuestPass: false };
	const run = (input: Partial<SponsorEligibilityInput>) =>
		planSponsorEligibility({ member: active, memberships: [regular], today, ...input });

	it("passes for an active member with a regular membership", () => {
		expect(run({}).success).toBe(true);
	});

	it("passes for an open-ended (complimentary/session) membership", () => {
		expect(run({ memberships: [{ ...regular, endDate: null }] }).success).toBe(true);
	});

	it("fails when not found or soft-deleted", () => {
		expect(run({ member: null }).success).toBe(false);
		expect(run({ member: { ...active, deletedAt: new Date() } }).success).toBe(false);
	});

	it("fails for an inactive member", () => {
		const result = run({ member: { ...active, memberStatus: "inactive" } });
		expect(!result.success && result.error.message).toMatch(/not an active member/);
	});

	it("fails with no membership covering today", () => {
		expect(run({ memberships: [] }).success).toBe(false);
		expect(run({ memberships: [{ ...regular, status: "expired" }] }).success).toBe(false);
		expect(run({ memberships: [{ ...regular, startDate: "2026-10-17" }] }).success).toBe(false);
		expect(run({ memberships: [{ ...regular, endDate: "2026-10-15" }] }).success).toBe(false);
	});

	it("fails when the only membership is a guest pass", () => {
		const result = run({ memberships: [{ ...regular, isGuestPass: true }] });
		expect(!result.success && result.error.message).toMatch(/guest pass/i);
	});

	it("passes when a regular membership sits beside a guest pass", () => {
		expect(run({ memberships: [{ ...regular, isGuestPass: true }, regular] }).success).toBe(true);
	});
});

describe("planFriendEligibility", () => {
	const match = (overrides: Partial<IdentityMatch> = {}): IdentityMatch => ({
		id: "m1",
		memberNo: 1042,
		fullName: "Jane Doe",
		matchedFields: ["phone"],
		deletedAt: null,
		...overrides,
	});
	const voidedGuestHistory = (memberId = "m1"): MatchedMemberHistory => ({
		memberId,
		membershipCount: 0,
		payments: [{ status: "voided", sponsorMemberId: "s1" }],
	});

	it("is new when nothing matches", () => {
		expect(planFriendEligibility({ matches: [], history: [] })).toEqual({ kind: "new" });
	});

	it("blocks a phone match naming the field and member number", () => {
		const result = planFriendEligibility({
			matches: [match()],
			history: [{ memberId: "m1", membershipCount: 1, payments: [] }],
		});
		expect(result.kind).toBe("conflict");
		if (result.kind === "conflict") {
			expect(result.matchedField).toBe("phone");
			expect(result.error.type).toBe("ConflictError");
			expect(result.error.message).toContain("phone number");
			expect(result.error.message).toContain("1042");
		}
	});

	it("blocks an ID number match", () => {
		const result = planFriendEligibility({
			matches: [match({ matchedFields: ["idNumber"] })],
			history: [{ memberId: "m1", membershipCount: 0, payments: [{ status: "completed", sponsorMemberId: null }] }],
		});
		expect(result.kind === "conflict" && result.error.message).toContain("ID number");
	});

	it("blocks a soft-deleted match even with a voided-guest history", () => {
		const result = planFriendEligibility({
			matches: [match({ deletedAt: new Date() })],
			history: [voidedGuestHistory()],
		});
		expect(result.kind).toBe("conflict");
	});

	it("reuses a member left over from a voided guest pass", () => {
		expect(
			planFriendEligibility({ matches: [match()], history: [voidedGuestHistory()] })
		).toEqual({ kind: "reuse", memberId: "m1", memberNo: 1042 });
	});

	it("does not reuse when any payment is not a voided guest pass", () => {
		const history: MatchedMemberHistory = {
			memberId: "m1",
			membershipCount: 0,
			payments: [
				{ status: "voided", sponsorMemberId: "s1" },
				{ status: "voided", sponsorMemberId: null },
			],
		};
		expect(planFriendEligibility({ matches: [match()], history: [history] }).kind).toBe("conflict");
	});

	it("does not reuse a member with no payment history at all", () => {
		const history: MatchedMemberHistory = { memberId: "m1", membershipCount: 0, payments: [] };
		expect(planFriendEligibility({ matches: [match()], history: [history] }).kind).toBe("conflict");
	});

	it("conflicts when phone and ID match two different members", () => {
		const result = planFriendEligibility({
			matches: [match(), match({ id: "m2", memberNo: 1043, matchedFields: ["idNumber"] })],
			history: [voidedGuestHistory("m1"), voidedGuestHistory("m2")],
		});
		expect(result.kind).toBe("conflict");
	});
});

describe("mapGuestPassErrorToField", () => {
	it("maps sponsor, phone and ID failures to their fields", () => {
		expect(mapGuestPassErrorToField("The sponsor has no active membership today.")).toBe("sponsorMemberId");
		expect(mapGuestPassErrorToField("A member with this phone number already exists (member no. 1).")).toBe(
			"friend.contact"
		);
		expect(mapGuestPassErrorToField("A member with this ID number already exists.")).toBe("friend.idNumber");
	});

	it("leaves other failures form-level", () => {
		expect(mapGuestPassErrorToField("Selected dates overlap with an existing membership.")).toBeNull();
	});
});
