import { and, asc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";
import type { Transaction } from "./payroll-slips.api";
import { normalizePayrollText, toPayrollDecimalString } from "../lib/helpers";
import {
	LOAN_STATUS,
	PAYROLL_PERIOD_STATUS,
	SALARY_ADVANCE_STATUS,
} from "../lib/payroll-constants";
import {
	employeeLoans,
	employees,
	journalEntries,
	journalLines,
	loanRepayments,
	overtimeRecords,
	payrollDeductions,
	payrollPeriods,
	payrollSlips,
	salaryAdvanceRecoveries,
	salaryAdvances,
} from "@/drizzle/schema";
import { toNumber } from "@/lib/helpers";
import type {
	LoanRepaymentRecord,
	PayrollPeriodRecord,
	PayrollPeriodTotals,
	PayrollSlipRecord,
	SalaryAdvanceRecoveryRecord,
	SkippedEmployee,
	SlipWarning,
} from "../lib/payroll.types";
import { db } from "@/drizzle/db";
import type { PayrollDbClient } from "../lib/payroll-rate-resolver";
import { sumValues } from "../lib/payroll-journal-helpers";

async function calculatePayrollPeriodTotals(
	periodId: string,
	dbClient: PayrollDbClient = db
): Promise<PayrollPeriodTotals> {
	const rows = await dbClient.query.payrollSlips.findMany({
		where: and(eq(payrollSlips.payrollPeriodId, periodId), ne(payrollSlips.status, "cancelled")),
	});

	return rows.reduce<PayrollPeriodTotals>(
		(accumulator, slip) => {
			accumulator.totalGrossPay = sumValues([accumulator.totalGrossPay, toNumber(slip.grossPay)]);
			accumulator.totalNetPay = sumValues([accumulator.totalNetPay, toNumber(slip.netPay)]);
			accumulator.totalPaye = sumValues([accumulator.totalPaye, toNumber(slip.netPaye)]);
			accumulator.totalNssfEmployee = sumValues([
				accumulator.totalNssfEmployee,
				toNumber(slip.nssfEmployee),
			]);
			accumulator.totalNssfEmployer = sumValues([
				accumulator.totalNssfEmployer,
				toNumber(slip.nssfEmployer),
			]);
			accumulator.totalShifEmployee = sumValues([
				accumulator.totalShifEmployee,
				toNumber(slip.shifEmployee),
			]);
			accumulator.totalShifEmployer = sumValues([
				accumulator.totalShifEmployer,
				toNumber(slip.shifEmployer),
			]);
			accumulator.totalAhlEmployee = sumValues([
				accumulator.totalAhlEmployee,
				toNumber(slip.ahlEmployee),
			]);
			accumulator.totalAhlEmployer = sumValues([
				accumulator.totalAhlEmployer,
				toNumber(slip.ahlEmployer),
			]);
			accumulator.totalNita = sumValues([accumulator.totalNita, toNumber(slip.nitaLevy)]);
			accumulator.totalLoanDeductions = sumValues([
				accumulator.totalLoanDeductions,
				toNumber(slip.totalLoanDeductions),
			]);
			accumulator.totalAdvanceRecoveries = sumValues([
				accumulator.totalAdvanceRecoveries,
				toNumber(slip.totalAdvanceRecoveries),
			]);
			accumulator.totalOtherDeductions = sumValues([
				accumulator.totalOtherDeductions,
				toNumber(slip.totalOtherDeductions),
			]);
			accumulator.totalPensionEmployer = sumValues([
				accumulator.totalPensionEmployer,
				toNumber(slip.pensionEmployerContribution),
			]);
			accumulator.totalEmployerCost = sumValues([
				accumulator.totalEmployerCost,
				toNumber(slip.totalEmployerCost),
			]);
			accumulator.employeeCount += 1;
			return accumulator;
		},
		{
			totalGrossPay: 0,
			totalNetPay: 0,
			totalPaye: 0,
			totalNssfEmployee: 0,
			totalNssfEmployer: 0,
			totalShifEmployee: 0,
			totalShifEmployer: 0,
			totalAhlEmployee: 0,
			totalAhlEmployer: 0,
			totalNita: 0,
			totalLoanDeductions: 0,
			totalAdvanceRecoveries: 0,
			totalOtherDeductions: 0,
			totalPensionEmployer: 0,
			totalEmployerCost: 0,
			employeeCount: 0,
		}
	);
}

async function reverseLoanRepayment(tx: Transaction, repayment: LoanRepaymentRecord) {
	const loan = await tx.query.employeeLoans.findFirst({
		where: eq(employeeLoans.id, repayment.loanId),
	});

	if (!loan) {
		throw new Error("Loan not found while reversing payroll slip.");
	}

	if (repayment.journalEntryId) {
		await tx.delete(journalLines).where(eq(journalLines.journalEntryId, repayment.journalEntryId));
		await tx.delete(journalEntries).where(eq(journalEntries.id, repayment.journalEntryId));
	}

	await tx.delete(loanRepayments).where(eq(loanRepayments.id, repayment.id));
	await tx
		.update(employeeLoans)
		.set({
			outstandingBalance: toPayrollDecimalString(repayment.balanceBefore),
			totalPrincipalPaid: toPayrollDecimalString(
				toNumber(loan.totalPrincipalPaid) - toNumber(repayment.principalComponent)
			),
			totalInterestPaid: toPayrollDecimalString(
				toNumber(loan.totalInterestPaid) - toNumber(repayment.interestComponent)
			),
			instalmentsPaid: Math.max(loan.instalmentsPaid - 1, 0),
			status: LOAN_STATUS.ACTIVE,
			settledDate: null,
		})
		.where(eq(employeeLoans.id, loan.id));
}

async function reverseAdvanceRecovery(tx: Transaction, recovery: SalaryAdvanceRecoveryRecord) {
	const advance = await tx.query.salaryAdvances.findFirst({
		where: eq(salaryAdvances.id, recovery.advanceId),
	});

	if (!advance) {
		throw new Error("Salary advance not found while reversing payroll slip.");
	}

	if (recovery.clearingJournalEntryId) {
		await tx
			.delete(journalLines)
			.where(eq(journalLines.journalEntryId, recovery.clearingJournalEntryId));
		await tx.delete(journalEntries).where(eq(journalEntries.id, recovery.clearingJournalEntryId));
	}

	await tx.delete(salaryAdvanceRecoveries).where(eq(salaryAdvanceRecoveries.id, recovery.id));
	await tx
		.update(salaryAdvances)
		.set({
			outstandingBalance: toPayrollDecimalString(recovery.balanceBefore),
			recoveriesProcessed: Math.max(advance.recoveriesProcessed - 1, 0),
			totalRecovered: toPayrollDecimalString(
				toNumber(advance.totalRecovered) - toNumber(recovery.recoveryAmount)
			),
			status:
				toNumber(recovery.balanceBefore) >=
				toNumber(advance.approvedAmount ?? advance.requestedAmount)
					? SALARY_ADVANCE_STATUS.DISBURSED
					: SALARY_ADVANCE_STATUS.RECOVERING,
		})
		.where(eq(salaryAdvances.id, advance.id));
}

export async function getEligibleEmployeesForPeriod(periodStart: string, periodEnd: string) {
	return db.query.employees.findMany({
		where: and(
			isNull(employees.deletedAt),
			lte(employees.hireDate, periodEnd),
			or(
				eq(employees.status, "active"),
				and(gte(employees.terminationDate, periodStart), lte(employees.terminationDate, periodEnd))
			)
		),
		orderBy: [asc(employees.firstName), asc(employees.lastName)],
	});
}

export async function reverseSlip(
	tx: Transaction,
	slip: PayrollSlipRecord,
	options?: {
		reason?: string | null;
		cancelledBy?: string | null;
	}
) {
	if (slip.status === "approved") {
		console.warn(`Reversing approved payroll slip ${slip.id}.`);
	}

	if (slip.overtimeRecordId) {
		await tx
			.update(overtimeRecords)
			.set({
				status: "approved",
				payrollSlipId: null,
			})
			.where(eq(overtimeRecords.id, slip.overtimeRecordId));
	}

	const [loanRows, advanceRows] = await Promise.all([
		tx.query.loanRepayments.findMany({
			where: eq(loanRepayments.payrollSlipId, slip.id),
		}),
		tx.query.salaryAdvanceRecoveries.findMany({
			where: eq(salaryAdvanceRecoveries.payrollSlipId, slip.id),
		}),
	]);

	for (const repayment of loanRows) {
		await reverseLoanRepayment(tx, repayment);
	}

	for (const recovery of advanceRows) {
		await reverseAdvanceRecovery(tx, recovery);
	}

	await tx.delete(payrollDeductions).where(eq(payrollDeductions.payrollSlipId, slip.id));
	await tx
		.update(payrollSlips)
		.set({
			status: "cancelled",
			cancelledBy: options?.cancelledBy ?? null,
			cancelledAt: new Date(),
			cancellationReason: normalizePayrollText(options?.reason ?? null),
		})
		.where(eq(payrollSlips.id, slip.id));
}

export async function updatePayrollPeriodAggregates(
	periodId: string,
	dbClient: PayrollDbClient = db,
	options?: {
		processingWarnings?: SlipWarning[];
		skippedEmployees?: SkippedEmployee[];
		status?: PayrollPeriodRecord["status"];
		processingStartedAt?: Date;
		processingCompletedAt?: Date | null;
		cancelledBy?: string | null;
		cancelledAt?: Date | null;
		cancellationReason?: string | null;
	}
) {
	const totals = await calculatePayrollPeriodTotals(periodId, dbClient);
	const [updated] = await dbClient
		.update(payrollPeriods)
		.set({
			totalGrossPay: toPayrollDecimalString(totals.totalGrossPay),
			totalNetPay: toPayrollDecimalString(totals.totalNetPay),
			totalPaye: toPayrollDecimalString(totals.totalPaye),
			totalNssfEmployee: toPayrollDecimalString(totals.totalNssfEmployee),
			totalNssfEmployer: toPayrollDecimalString(totals.totalNssfEmployer),
			totalShifEmployee: toPayrollDecimalString(totals.totalShifEmployee),
			totalShifEmployer: toPayrollDecimalString(totals.totalShifEmployer),
			totalAhlEmployee: toPayrollDecimalString(totals.totalAhlEmployee),
			totalAhlEmployer: toPayrollDecimalString(totals.totalAhlEmployer),
			totalNita: toPayrollDecimalString(totals.totalNita),
			totalLoanDeductions: toPayrollDecimalString(totals.totalLoanDeductions),
			totalAdvanceRecoveries: toPayrollDecimalString(totals.totalAdvanceRecoveries),
			totalOtherDeductions: toPayrollDecimalString(totals.totalOtherDeductions),
			totalPensionEmployer: toPayrollDecimalString(totals.totalPensionEmployer),
			employeeCount: totals.employeeCount,
			processingWarnings: options?.processingWarnings
				? JSON.stringify(options.processingWarnings)
				: undefined,
			skippedEmployees: options?.skippedEmployees
				? JSON.stringify(options.skippedEmployees)
				: undefined,
			status: options?.status,
			processingStartedAt: options?.processingStartedAt,
			processingCompletedAt:
				options?.processingCompletedAt !== undefined ? options.processingCompletedAt : undefined,
			cancelledBy: options?.cancelledBy !== undefined ? options.cancelledBy : undefined,
			cancelledAt: options?.cancelledAt !== undefined ? options.cancelledAt : undefined,
			cancellationReason:
				options?.cancellationReason !== undefined
					? normalizePayrollText(options.cancellationReason)
					: undefined,
			updatedAt: new Date(),
		})
		.where(eq(payrollPeriods.id, periodId))
		.returning();

	return { period: updated, totals };
}

export async function cancelProcessedPayrollPeriod(
	periodId: string,
	cancelledBy: string,
	reason: string,
	tx: Transaction
) {
	const slips = await tx.query.payrollSlips.findMany({
		where: and(eq(payrollSlips.payrollPeriodId, periodId), ne(payrollSlips.status, "cancelled")),
	});

	for (const slip of slips) {
		await reverseSlip(tx, slip, {
			cancelledBy,
			reason,
		});
	}

	await updatePayrollPeriodAggregates(periodId, tx, {
		processingWarnings: [],
		skippedEmployees: [],
		processingCompletedAt: null,
		status: PAYROLL_PERIOD_STATUS.CANCELLED,
		cancelledBy,
		cancelledAt: new Date(),
		cancellationReason: reason,
	});
}
