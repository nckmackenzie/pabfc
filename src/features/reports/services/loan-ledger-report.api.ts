import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	buildLoanStatementRows,
	buildLoanSummaryReport,
	computeLoanCurrentPosition,
	computeLoanStatementTotals,
} from "@/features/reports/lib/loan-ledger-report";
import { loanStatusSchema } from "@/features/payroll/services/loan.schemas";
import {
	getAllActiveLoansFn,
	getLoanByIdFn,
	getLoanFormOptionsFn,
	getLoanLedgerFn,
} from "@/features/payroll/services/loans.api";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

const loanSummaryReportRequestSchema = z.object({
	employeeId: z.string().trim().optional(),
	status: loanStatusSchema.optional(),
});

const loanStatementRequestSchema = z.object({
	loanId: z.string().trim().min(1, "Loan is required"),
});

export const getLoanLedgerReportOptions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("reports:hr-reports");

		const options = await getLoanFormOptionsFn();

		return {
			employees: options.employees.map((employee) => ({
				value: employee.id,
				label: `${employee.fullName} (${employee.employeeNo})`,
			})),
		};
	});

export const getLoanSummaryReport = createServerFn()
	.middleware([authMiddleware])
	.validator(loanSummaryReportRequestSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:hr-reports");

		const rows = await getAllActiveLoansFn({
			data: {
				q: "",
				employeeId: data.employeeId,
				status: data.status ?? "all",
			},
		});

		return buildLoanSummaryReport(rows);
	});

export const getLoanStatement = createServerFn()
	.middleware([authMiddleware])
	.validator(loanStatementRequestSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:hr-reports");

		const [detail, ledger, accountRow] = await Promise.all([
			getLoanByIdFn({ data: { loanId: data.loanId } }),
			getLoanLedgerFn({ data: { loanId: data.loanId } }),
			db.query.employeeLoans.findFirst({
				columns: {},
				where: (employeeLoans, { eq }) => eq(employeeLoans.id, data.loanId),
				with: {
					disbursementAccount: {
						columns: { name: true },
					},
				},
			}),
		]);

		const rows = buildLoanStatementRows(detail.repayments, ledger.entries);
		const totals = computeLoanStatementTotals(rows);
		const currentPosition = computeLoanCurrentPosition(detail);

		return {
			loanId: detail.id,
			header: {
				employeeName: detail.fullName,
				employeeNo: detail.employeeNo,
				loanReference: detail.id,
				disbursementDate: detail.disbursementDate,
				disbursementAccountName: accountRow?.disbursementAccount?.name ?? null,
				originalApprovedAmount: detail.approvedAmount ?? detail.principalAmount,
				annualInterestRate: detail.annualInterestRate,
				approvedInstalments: detail.approvedInstalments ?? detail.requestedInstalments,
				repaymentStartMonth: detail.repaymentStartMonth,
				repaymentStartYear: detail.repaymentStartYear,
			},
			rows,
			totals,
			currentPosition,
		};
	});

export type LoanLedgerReportOptionsResponse = Awaited<
	ReturnType<typeof getLoanLedgerReportOptions>
>;
export type LoanSummaryReportResponse = Awaited<ReturnType<typeof getLoanSummaryReport>>;
export type LoanStatementResponse = Awaited<ReturnType<typeof getLoanStatement>>;
