import { describe, expect, it } from "vitest";
import { planSessionReconciliation } from "./reconciliation";

const baseMembership = {
	id: "m1",
	memberId: "mem1",
	startDate: "2026-01-01",
	endDate: "2026-03-31",
	originalEndDate: null as string | null,
	status: "active" as const,
	sessionsTotal: 3,
};

describe("planSessionReconciliation", () => {
	it("consumes eligible days in ascending order, one insertUsage per day", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [],
			dailyAttendance: [
				{ attendanceDate: "2026-01-05", firstAttendanceLogId: 5n },
				{ attendanceDate: "2026-01-02", firstAttendanceLogId: 2n },
			],
			today: "2026-01-06",
		});
		expect(actions).toEqual([
			{ type: "insertUsage", usageDate: "2026-01-02", attendanceLogId: 2n },
			{ type: "insertUsage", usageDate: "2026-01-05", attendanceLogId: 5n },
		]);
	});

	it("marks punches beyond sessionsTotal as overConsumption instead of inserting", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-02", voidedAt: null },
				{ id: "u3", usageDate: "2026-01-03", voidedAt: null },
			],
			dailyAttendance: [{ attendanceDate: "2026-01-04", firstAttendanceLogId: 4n }],
			today: "2026-01-04",
		});
		expect(actions).toEqual([
			{ type: "overConsumption", usageDate: "2026-01-04" },
			{ type: "truncateEnd", originalEndDate: "2026-03-31", newEndDate: "2026-01-03" },
		]);
	});

	it("truncates the end date to the last usage date once sessions are exhausted", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-02", voidedAt: null },
			],
			dailyAttendance: [{ attendanceDate: "2026-01-10", firstAttendanceLogId: 10n }],
			today: "2026-01-10",
		});
		expect(actions).toEqual([
			{ type: "insertUsage", usageDate: "2026-01-10", attendanceLogId: 10n },
			{ type: "truncateEnd", originalEndDate: "2026-03-31", newEndDate: "2026-01-10" },
		]);
	});

	it("never re-counts a waived (voided) day", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [{ id: "u1", usageDate: "2026-01-02", voidedAt: new Date("2026-01-03") }],
			dailyAttendance: [{ attendanceDate: "2026-01-02", firstAttendanceLogId: 2n }],
			today: "2026-01-05",
		});
		expect(actions).toEqual([]);
	});

	it("restores the end date and flags reactivate when a waiver drops used below total on an expired membership", () => {
		const actions = planSessionReconciliation({
			membership: {
				...baseMembership,
				status: "expired",
				endDate: "2026-01-10",
				originalEndDate: "2026-03-31",
			},
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-05", voidedAt: null },
				{ id: "u3", usageDate: "2026-01-10", voidedAt: new Date("2026-01-11") },
			],
			dailyAttendance: [],
			today: "2026-01-20",
		});
		expect(actions).toEqual([
			{ type: "restoreEnd", endDate: "2026-03-31", reactivate: true },
		]);
	});

	it("restores without reactivating when the membership is not expired", () => {
		const actions = planSessionReconciliation({
			membership: {
				...baseMembership,
				status: "active",
				endDate: "2026-01-10",
				originalEndDate: "2026-03-31",
			},
			usageRows: [
				{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
				{ id: "u2", usageDate: "2026-01-05", voidedAt: new Date("2026-01-06") },
			],
			dailyAttendance: [],
			today: "2026-01-20",
		});
		expect(actions).toEqual([{ type: "restoreEnd", endDate: "2026-03-31", reactivate: false }]);
	});

	it("ignores daily-attendance days outside the membership window", () => {
		const actions = planSessionReconciliation({
			membership: baseMembership,
			usageRows: [],
			dailyAttendance: [
				{ attendanceDate: "2025-12-31", firstAttendanceLogId: 1n },
				{ attendanceDate: "2026-04-01", firstAttendanceLogId: 2n },
			],
			today: "2026-04-02",
		});
		expect(actions).toEqual([]);
	});

	it("is idempotent: feeding its own output back in produces no new actions", () => {
		const firstPassUsage = [
			{ id: "u1", usageDate: "2026-01-01", voidedAt: null },
			{ id: "u2", usageDate: "2026-01-02", voidedAt: null },
			{ id: "u3", usageDate: "2026-01-03", voidedAt: null },
		];
		const membershipAfterTruncation = {
			...baseMembership,
			endDate: "2026-01-03",
			originalEndDate: "2026-03-31",
		};
		const actions = planSessionReconciliation({
			membership: membershipAfterTruncation,
			usageRows: firstPassUsage,
			dailyAttendance: [],
			today: "2026-01-10",
		});
		expect(actions).toEqual([]);
	});
});
