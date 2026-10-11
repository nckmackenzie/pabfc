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
