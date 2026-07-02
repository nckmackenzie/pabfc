import { describe, expect, it } from "vitest";
import {
	buildLoanStatementRows,
	buildLoanSummaryReport,
	computeLoanCurrentPosition,
	computeLoanStatementTotals,
} from "@/features/reports/lib/loan-ledger-report";

describe("loan-ledger-report", () => {
	it("reconciles summary totals against the individual rows", () => {
		const report = buildLoanSummaryReport([
			{
				id: "LN-001",
				fullName: "Jane Doe",
				disbursementDate: "2026-01-05",
				approvedAmount: 120000,
				principalAmount: 100000,
				monthlyInstalment: 10000,
				totalPrincipalPaid: 20000,
				totalInterestPaid: 5000,
				outstandingBalance: 95000,
				instalmentsPaid: 2,
				status: "active",
			},
			{
				id: "LN-002",
				fullName: "John Doe",
				disbursementDate: "2026-02-10",
				approvedAmount: null,
				principalAmount: 50000,
				monthlyInstalment: 5000,
				totalPrincipalPaid: 10000,
				totalInterestPaid: 2500,
				outstandingBalance: 42500,
				instalmentsPaid: 2,
				status: "paused",
			},
		]);

		expect(report.totals).toEqual({
			originalAmount: 170000,
			totalRepaid: 37500,
			outstandingBalance: 137500,
		});
	});

	it("computes instalments remaining and floors the value at zero", () => {
		expect(
			computeLoanCurrentPosition({
				approvedInstalments: 12,
				requestedInstalments: 12,
				instalmentsPaid: 5,
				outstandingBalance: 35000,
				status: "active",
			})
		).toEqual({
			outstandingBalance: 35000,
			instalmentsRemaining: 7,
			status: "active",
		});

		expect(
			computeLoanCurrentPosition({
				approvedInstalments: 6,
				requestedInstalments: 6,
				instalmentsPaid: 9,
				outstandingBalance: 0,
				status: "fully_paid",
			})
		).toEqual({
			outstandingBalance: 0,
			instalmentsRemaining: 0,
			status: "fully_paid",
		});
	});

	it("shows zero outstanding balance and correct paid totals for fully paid loans", () => {
		const rows = buildLoanStatementRows(
			[
				{ periodMonth: 1, periodYear: 2026 },
				{ periodMonth: 2, periodYear: 2026 },
			],
			[
				{
					date: "2026-01-31",
					principal: 5000,
					interest: 500,
					total: 5500,
					balanceBefore: 10000,
					balanceAfter: 5000,
					isEarlySettlement: false,
				},
				{
					date: "2026-02-28",
					principal: 5000,
					interest: 0,
					total: 5000,
					balanceBefore: 5000,
					balanceAfter: 0,
					isEarlySettlement: true,
				},
			]
		);

		expect(computeLoanStatementTotals(rows)).toEqual({
			totalPrincipalPaid: 10000,
			totalInterestPaid: 500,
			totalPaid: 10500,
		});
		expect(rows.at(-1)?.balanceAfter).toBe(0);
	});
});
