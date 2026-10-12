import { describe, expect, it } from "vitest";
import { pickCurrentSessionMembership } from "./session-membership";

describe("pickCurrentSessionMembership", () => {
	it("returns null when the member has no session memberships", () => {
		expect(pickCurrentSessionMembership([])).toBeNull();
	});

	it("prefers the active membership over any other status", () => {
		const memberships = [
			{ id: "m1", status: "expired", endDate: "2026-01-10" },
			{ id: "m2", status: "active", endDate: "2026-03-31" },
			{ id: "m3", status: "expired", endDate: "2025-12-01" },
		];
		expect(pickCurrentSessionMembership(memberships)?.id).toBe("m2");
	});

	it("falls back to the most recent by endDate when none is active", () => {
		const memberships = [
			{ id: "m1", status: "expired", endDate: "2026-01-10" },
			{ id: "m2", status: "pending", endDate: "2026-03-31" },
			{ id: "m3", status: "expired", endDate: "2025-12-01" },
		];
		expect(pickCurrentSessionMembership(memberships)?.id).toBe("m2");
	});

	it("treats a null endDate as later than any dated one", () => {
		const memberships = [
			{ id: "m1", status: "expired", endDate: "2026-01-10" },
			{ id: "m2", status: "terminated", endDate: null },
		];
		expect(pickCurrentSessionMembership(memberships)?.id).toBe("m2");
	});
});
