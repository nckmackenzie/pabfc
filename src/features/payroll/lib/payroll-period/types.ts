import type { payrollPeriodCreateFormSchema } from "@/features/payroll/services/payroll-period.schemas";
import type { z } from "zod";
import type { PayrollPeriodStatus } from "../payroll-constants";
import type { AppError } from "@/lib/result";

export type PayrollTransitionAbort = {
	appError: AppError;
};

export type PayrollPeriodCreatePayload = z.infer<typeof payrollPeriodCreateFormSchema>;
export type PayrollPeriodView = {
	id: string;
	name: string;
	periodMonth: number;
	periodYear: number;
	periodStart: string;
	periodEnd: string;
	payDate: string;
	status: PayrollPeriodStatus;
	totalGrossPay: number | null;
	totalNetPay: number | null;
	totalPaye: number | null;
	totalNssfEmployee: number | null;
	totalNssfEmployer: number | null;
	totalShifEmployee: number | null;
	totalShifEmployer: number | null;
	totalAhlEmployee: number | null;
	totalAhlEmployer: number | null;
	totalNita: number | null;
	totalLoanDeductions: number | null;
	totalAdvanceRecoveries: number | null;
	totalOtherDeductions: number | null;
	totalPensionEmployer: number | null;
	employeeCount: number | null;
	processingWarnings: Array<{
		employeeId: string;
		employeeName: string;
		message: string;
	}>;
	skippedEmployees: Array<{
		employeeId: string;
		employeeName: string;
		reason: string;
	}>;
	processingStartedAt: Date | null;
	processingCompletedAt: Date | null;
	approvedBy: string | null;
	approvedAt: Date | null;
	paidAt: Date | null;
	closedAt: Date | null;
	cancelledBy: string | null;
	cancelledAt: Date | null;
	cancellationReason: string | null;
	disbursementJournalEntryId: number | null;
	remittanceJournalEntryId: number | null;
	payrollJournalEntryId: number | null;
	notes: string | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
	statutoryRemittanceDeadline: string;
	daysUntilRemittanceDeadline: number;
	allowedTransitions: PayrollPeriodStatus[];
};
