import { describe, expect, it } from "vitest";
import { formatPlanOptionLabel } from "./format";

describe("formatPlanOptionLabel", () => {
	it("appends the session count for a session-based plan", () => {
		expect(
			formatPlanOptionLabel({ name: "10 Session Pack", isSessionBased: true, sessionCount: 10 })
		).toBe("10 Session Pack (10 sessions)");
	});

	it("uses singular 'session' for a count of 1", () => {
		expect(
			formatPlanOptionLabel({ name: "Single Visit", isSessionBased: true, sessionCount: 1 })
		).toBe("Single Visit (1 session)");
	});

	it("returns the plain name for a non-session-based plan", () => {
		expect(
			formatPlanOptionLabel({ name: "Monthly", isSessionBased: false, sessionCount: 0 })
		).toBe("Monthly");
	});
});
