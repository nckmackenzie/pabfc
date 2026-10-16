import { describe, expect, it } from "vitest";
import { planSchema } from "./schemas";

const basePlan = {
	name: "10 Session Pack",
	duration: 90,
	price: 5000,
	description: null,
	isSessionBased: true,
	sessionCount: 10,
	active: true,
	isGuestPass: false,
	revenueAccountId: "1",
	lateUpgradeGraceDays: null,
};

describe("planSchema session-based member count guard", () => {
	it("rejects a session-based plan with memberCount other than 1", () => {
		const result = planSchema.safeParse({ ...basePlan, memberCount: 2 });
		expect(result.success).toBe(false);
	});

	it("accepts a session-based plan with memberCount 1", () => {
		const result = planSchema.safeParse({ ...basePlan, memberCount: 1 });
		expect(result.success).toBe(true);
	});

	it("does not restrict memberCount for a non-session-based plan", () => {
		const result = planSchema.safeParse({ ...basePlan, isSessionBased: false, memberCount: 4 });
		expect(result.success).toBe(true);
	});
});

describe("planSchema guest pass refinements", () => {
	const guestPlan = {
		...basePlan,
		isGuestPass: true,
		sessionCount: 1,
		memberCount: 1,
		validFrom: "2026-10-10",
		validTo: "2026-10-20",
	};
	const issuePaths = (input: object) => {
		const result = planSchema.safeParse(input);
		return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
	};

	it("accepts a valid guest pass", () => {
		expect(planSchema.safeParse(guestPlan).success).toBe(true);
	});

	it("requires the availability window", () => {
		expect(issuePaths({ ...guestPlan, validFrom: null })).toContain("validFrom");
		expect(issuePaths({ ...guestPlan, validTo: undefined })).toContain("validTo");
	});

	it("requires exactly one session", () => {
		expect(issuePaths({ ...guestPlan, sessionCount: 2 })).toContain("sessionCount");
	});

	it("requires memberCount 1", () => {
		expect(issuePaths({ ...guestPlan, memberCount: 2 })).toContain("memberCount");
	});

	it("rejects validTo before validFrom", () => {
		expect(issuePaths({ ...guestPlan, validTo: "2026-10-01" })).toContain("validTo");
	});

	it("rejects a zero price", () => {
		expect(issuePaths({ ...guestPlan, price: 0 })).toContain("price");
	});

	it("keeps the window optional for regular plans but still ordered", () => {
		expect(planSchema.safeParse({ ...basePlan, memberCount: 1 }).success).toBe(true);
		expect(
			issuePaths({ ...basePlan, memberCount: 1, validFrom: "2026-10-10", validTo: "2026-10-01" })
		).toContain("validTo");
	});
});
