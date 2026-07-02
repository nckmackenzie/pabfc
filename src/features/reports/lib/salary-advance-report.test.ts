import { describe, expect, it } from "vitest";
import {
	buildSalaryAdvanceSummaryReport,
	computeRecoveriesRemaining,
	resolveSalaryAdvanceStatuses,
} from "@/features/reports/lib/salary-advance-report";

describe("salary-advance-report", () => {
	it("floors recoveries remaining at zero", () => {
		expect(computeRecoveriesRemaining(6, 3)).toBe(3);
		expect(computeRecoveriesRemaining(6, 9)).toBe(0);
	});

	it("reconciles summary totals against individual rows", () => {
		const report = buildSalaryAdvanceSummaryReport([
			{
				id: "ADV-001",
				fullName: "Jane Doe",
				applicationDate: "2026-01-01",
				disbursementDate: "2026-01-03",
				approvedAmount: 30000,
				monthlyRecoveryAmount: 5000,
				totalRecovered: 10000,
				outstandingBalance: 20000,
				recoveriesProcessed: 2,
				approvedRecoveryMonths: 6,
				status: "recovering",
			},
			{
				id: "ADV-002",
				fullName: "John Doe",
				applicationDate: "2026-02-01",
				disbursementDate: "2026-02-05",
				approvedAmount: 20000,
				monthlyRecoveryAmount: 4000,
				totalRecovered: 8000,
				outstandingBalance: 12000,
				recoveriesProcessed: 2,
				approvedRecoveryMonths: 5,
				status: "disbursed",
			},
		]);

		expect(report.totals).toEqual({
			approvedAmount: 50000,
			totalRecovered: 18000,
			outstandingBalance: 32000,
		});
	});

	it("defaults the summary filter to the active advance statuses only", () => {
		expect(resolveSalaryAdvanceStatuses()).toEqual(["disbursed", "recovering"]);
		expect(resolveSalaryAdvanceStatuses("active")).toEqual(["disbursed", "recovering"]);
		expect(resolveSalaryAdvanceStatuses("all")).toBeNull();
		expect(resolveSalaryAdvanceStatuses("pending")).toEqual(["pending"]);
	});
});
