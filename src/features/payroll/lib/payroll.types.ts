import type { loanRepayments, payrollSlips, salaryAdvanceRecoveries,payrollPeriods,payrollDeductions,employees,salaryStructures,overtimeRecords,payrollPeriodOtherDeductions } from "@/drizzle/schema";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "@/drizzle/schema";

export type PayrollSlipRecord = typeof payrollSlips.$inferSelect;
export type LoanRepaymentRecord = typeof loanRepayments.$inferSelect;
export type SalaryAdvanceRecoveryRecord = typeof salaryAdvanceRecoveries.$inferSelect;

export type Transaction = PgTransaction<
    NodePgQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
>;

export type PayrollPeriodRecord = typeof payrollPeriods.$inferSelect;
export type PayrollDeductionRecord = typeof payrollDeductions.$inferSelect;
export type EmployeeRecord = typeof employees.$inferSelect;
export type SalaryStructureRecord = typeof salaryStructures.$inferSelect;
export type OvertimeRecord = typeof overtimeRecords.$inferSelect;
export type PayrollPeriodOtherDeductionRecord = typeof payrollPeriodOtherDeductions.$inferSelect;
export type ManualOtherDeductionType = Exclude<
    PayrollPeriodOtherDeductionRecord["deductionType"],
    "company_loan" | "salary_advance" | "helb"
>;

export type SlipWarning = {
    employeeId: string;
    employeeName: string;
    message: string;
};

export type SkippedEmployee = {
    employeeId: string;
    employeeName: string;
    reason: string;
};

export type PayrollRunSuccess = {
    success: true;
    periodId: string;
    periodName: string;
    employeesProcessed: number;
    employeesSkipped: number;
    processingDurationMs: number;
    totals: {
        grossPay: number;
        netPay: number;
        totalPaye: number;
        totalNssfEmployee: number;
        totalNssfEmployer: number;
        totalShifEmployee: number;
        totalShifEmployer: number;
        totalAhlEmployee: number;
        totalAhlEmployer: number;
        totalNita: number;
        totalLoanDeductions: number;
        totalAdvanceRecoveries: number;
        totalOtherDeductions: number;
        totalEmployerCost: number;
    };
    warnings: SlipWarning[];
    skippedEmployees: SkippedEmployee[];
    slipSummaries: Array<{
        employeeId: string;
        employeeName: string;
        grossPay: number;
        fullMonthGrossPay: number;
        isProrated: boolean;
        proratedDays: number | null;
        totalWorkingDays: number | null;
        totalDeductions: number;
        netPay: number;
        twoThirdsCapApplied: boolean;
    }>;
};

export type PayrollRunFailure = {
    success: false;
    periodId: string;
    error: string;
    failedEmployeeId: string | null;
    failedEmployeeName: string | null;
    rollbackConfirmed: true;
};

export type PayrollRunResult = PayrollRunSuccess | PayrollRunFailure;

export type PayrollPeriodTotals = {
    totalGrossPay: number;
    totalNetPay: number;
    totalPaye: number;
    totalNssfEmployee: number;
    totalNssfEmployer: number;
    totalShifEmployee: number;
    totalShifEmployer: number;
    totalAhlEmployee: number;
    totalAhlEmployer: number;
    totalNita: number;
    totalLoanDeductions: number;
    totalAdvanceRecoveries: number;
    totalOtherDeductions: number;
    totalPensionEmployer: number;
    totalEmployerCost: number;
    employeeCount: number;
};

export type EmployeePayrollHistoryItem = {
    slipId: string;
    periodId: string;
    periodName: string;
    periodMonth: number;
    periodYear: number;
    grossPay: number;
    fullMonthGrossPay: number;
    isProrated: boolean;
    netPay: number;
    totalPaye: number;
    totalNssf: number;
    status: PayrollSlipRecord["status"];
};

export type DepartmentPayrollSummaryItem = {
    departmentId: number | null;
    departmentName: string | null;
    employeeCount: number;
    proratedEmployeeCount: number;
    totalGrossPay: number;
    totalNetPay: number;
    totalEmployerCost: number;
};

export type PayrollAdjustmentOptions = {
    employees: Array<{
        id: string;
        employeeNo: string;
        fullName: string;
        departmentId: number | null;
        departmentName: string | null;
    }>;
    bonuses: Array<{
        id: string;
        employeeId: string;
        employeeName: string;
        amount: number;
        description: string;
        notes: string | null;
    }>;
    otherDeductions: Array<{
        id: string;
        employeeId: string;
        employeeName: string;
        deductionType: PayrollPeriodOtherDeductionRecord["deductionType"];
        amount: number;
        description: string;
        notes: string | null;
    }>;
};