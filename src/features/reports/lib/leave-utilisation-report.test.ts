import { describe, expect, it } from "vitest";
import {
	buildLeaveUtilisationReport,
	computeLeaveAvailableBalance,
} from "@/features/reports/lib/leave-utilisation-report";

describe("leave-utilisation-report", () => {
	it("uses the established available balance formula", () => {
		expect(
			computeLeaveAvailableBalance({
				entitledDays: 21,
				carriedForwardDays: 3,
				adjustmentDays: 2,
				takenDays: 10,
			})
		).toBe(16);
	});

	it("excludes zero-activity rows and reconciles totals", () => {
		const report = buildLeaveUtilisationReport(
			[
				{
					employeeId: "EMP-1",
					employeeName: "Jane Doe",
					employeeNo: "001",
					departmentName: "Admin",
					leaveType: "annual",
					entitledDays: 21,
					carriedForwardDays: 2,
					adjustmentDays: 0,
					takenDays: 5,
					carryForwardExpiresAt: null,
				},
				{
					employeeId: "EMP-1",
					employeeName: "Jane Doe",
					employeeNo: "001",
					departmentName: "Admin",
					leaveType: "sick",
					entitledDays: 0,
					carriedForwardDays: 0,
					adjustmentDays: 0,
					takenDays: 0,
					carryForwardExpiresAt: null,
				},
				{
					employeeId: "EMP-2",
					employeeName: "John Doe",
					employeeNo: "002",
					departmentName: "Operations",
					leaveType: "sick",
					entitledDays: 14,
					carriedForwardDays: 0,
					adjustmentDays: 1,
					takenDays: 4,
					carryForwardExpiresAt: null,
				},
			],
			2026
		);

		expect(report.rows).toHaveLength(2);
		expect(report.totals).toEqual({
			totalEntitled: 35,
			totalTaken: 9,
			totalAvailable: 29,
		});
	});

	it("uses takenDays from the balance row and does not fold in pending leave", () => {
		const report = buildLeaveUtilisationReport(
			[
				{
					employeeId: "EMP-1",
					employeeName: "Jane Doe",
					employeeNo: "001",
					departmentName: "Admin",
					leaveType: "annual",
					entitledDays: 21,
					carriedForwardDays: 0,
					adjustmentDays: 0,
					takenDays: 4,
					carryForwardExpiresAt: null,
					pendingDays: 3,
				} as never,
			],
			2026
		);

		expect(report.rows[0]?.takenDays).toBe(4);
		expect(report.rows[0]?.availableBalance).toBe(17);
	});
});
