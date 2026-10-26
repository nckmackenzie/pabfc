import { describe, expect, it, vi } from "vitest";

vi.mock("@/drizzle/db", () => ({ db: {} }));

import { type MemberStateInput, planMemberStateChanges } from "@/services/member-state";

const row = (overrides: Partial<MemberStateInput> = {}): MemberStateInput => ({
	memberId: "m1",
	memberStatus: "active",
	deletedAt: null,
	desiredAccessEnabled: true,
	hasActiveMembership: true,
	...overrides,
});

describe("planMemberStateChanges", () => {
	it("deactivates an active member with no active membership and disables access", () => {
		expect(planMemberStateChanges([row({ hasActiveMembership: false })])).toEqual([
			{ memberId: "m1", statusChange: "inactive", accessChange: "disable" },
		]);
	});

	it("activates an inactive member with an active membership and enables access", () => {
		expect(
			planMemberStateChanges([
				row({ memberStatus: "inactive", desiredAccessEnabled: false, hasActiveMembership: true }),
			])
		).toEqual([{ memberId: "m1", statusChange: "active", accessChange: "enable" }]);
	});

	it("keeps a member with only a pending membership inactive with no access", () => {
		// A pending (future-dated) membership is not "active", so the caller passes false.
		expect(
			planMemberStateChanges([
				row({ memberStatus: "inactive", desiredAccessEnabled: false, hasActiveMembership: false }),
			])
		).toEqual([]);
	});

	it("removes access from an inactive member whose access was left on", () => {
		expect(
			planMemberStateChanges([
				row({ memberStatus: "inactive", desiredAccessEnabled: true, hasActiveMembership: false }),
			])
		).toEqual([{ memberId: "m1", accessChange: "disable" }]);
	});

	it("never touches frozen, terminated or soft-deleted members", () => {
		expect(
			planMemberStateChanges([
				row({ memberId: "f", memberStatus: "frozen", hasActiveMembership: false }),
				row({ memberId: "t", memberStatus: "terminated", hasActiveMembership: true, desiredAccessEnabled: false }),
				row({ memberId: "d", deletedAt: new Date(), hasActiveMembership: false }),
			])
		).toEqual([]);
	});

	it("returns nothing for members that are already consistent", () => {
		expect(
			planMemberStateChanges([
				row(),
				row({ memberId: "m2", memberStatus: "inactive", desiredAccessEnabled: false, hasActiveMembership: false }),
			])
		).toEqual([]);
	});

	it("changes status only when the member has no BioTime profile", () => {
		expect(
			planMemberStateChanges([row({ hasActiveMembership: false, desiredAccessEnabled: null })])
		).toEqual([{ memberId: "m1", statusChange: "inactive" }]);
	});
});
