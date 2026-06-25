import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
	getEmployeesForSalaryStructureOptionsFn,
	getSalaryHistoryFn,
	getSalaryStructureByIdFn,
	getSalaryStructureDirectoryFn,
	getSalaryStructureEmployeeSummaryFn,
} from "@/features/payroll/services/salary-structures.api";
import {
	getOvertimeFormOptionsFn,
	getOvertimeRecordDetailFn,
	getOvertimeRecordForEmployeeFn,
	getOvertimeRecordsByPeriodFn,
	getOvertimeSummaryForEmployeeFn,
} from "@/features/payroll/services/overtime.api";
import {
	getAllAccountMappingsFn,
	getPayrollMappingAccountOptionsFn,
} from "@/features/payroll/services/account-mappings.api";
import {
	getCurrentStatutoryRatesFn,
	getStatutoryRateHistoryFn,
} from "@/features/payroll/services/statutory-rates.api";
import {
	getAllActiveLoansFn,
	getLoanByIdFn,
	getLoanFormOptionsFn,
	getLoanLedgerFn,
	getLoansByEmployeeFn,
} from "@/features/payroll/services/loans.api";
import {
	getAdvanceByIdFn,
	getAdvanceRecoveryStatementFn,
	getAdvancesByEmployeeFn,
	getAllActiveAdvancesFn,
	getAllPendingAdvancesFn,
	getSalaryAdvanceFormOptionsFn,
} from "@/features/payroll/services/salary-advances.api";
import {
	getActivePayrollPeriodFn,
	getAllPayrollPeriodsFn,
	getPayrollPeriodByIdFn,
	getPeriodRemittanceStatusFn,
	runPayrollPeriodPreflightFn,
	getYearToDateTotalsFn,
} from "@/features/payroll/services/payroll-periods.api";
import {
	getJournalEntryWithLinesFn,
	getPayrollJournalPostingOptionsFn,
	getPayrollJournalSummaryFn,
} from "@/features/payroll/services/payroll-journals.api";
import {
	getEmployeePayrollHistoryFn,
	getPayrollAdjustmentOptionsFn,
	getPayrollPeriodBonusesFn,
	getPayrollPeriodOtherDeductionsFn,
	getPayrollSlipByIdFn,
	getPayrollSlipForEmployeeFn,
	getPayrollSlipsForPeriodFn,
	getPayrollSummaryByDepartmentFn,
} from "@/features/payroll/services/payroll-slips.api";
import type {
	salaryHistoryParamsSchema,
	salaryStructureDetailParamsSchema,
	salaryStructureDirectoryFilterSchema,
	salaryStructureEmployeeSummarySchema,
} from "@/features/payroll/services/schemas";
import type { statutoryRateHistorySchema } from "@/features/payroll/services/statutory-rates.schemas";
import type {
	allActiveLoansFilterSchema,
	loanByIdSchema,
	loansByEmployeeSchema,
} from "@/features/payroll/services/loan.schemas";
import type {
	allActiveSalaryAdvancesFilterSchema,
	salaryAdvanceByIdSchema,
	salaryAdvancesByEmployeeSchema,
} from "@/features/payroll/services/salary-advance.schemas";
import type {
	overtimeRecordByEmployeePeriodSchema,
	overtimeRecordByIdSchema,
	overtimeRecordPeriodSearchSchema,
	overtimeSummaryRangeSchema,
} from "@/features/payroll/services/overtime.schemas";
import type {
	payrollPeriodFiltersSchema,
	payrollPeriodIdSchema,
	payrollPeriodYearSchema,
} from "@/features/payroll/services/payroll-period.schemas";
import type {
	employeePayrollHistorySchema,
	payrollDepartmentSummarySchema,
	payrollPeriodAdjustmentOptionsSchema,
	payrollSlipForEmployeeSchema,
	payrollSlipIdSchema,
	payrollSlipPeriodSearchSchema,
} from "@/features/payroll/services/payroll-slips.schemas";
import type { z } from "zod";

export const salaryStructureQueries = {
	all: ["salary-structures"] as const,
	directory: (filters: z.infer<typeof salaryStructureDirectoryFilterSchema>) =>
		queryOptions({
			queryKey: [...salaryStructureQueries.all, "directory", filters] as const,
			queryFn: () => getSalaryStructureDirectoryFn({ data: filters }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	employees: () =>
		queryOptions({
			queryKey: [...salaryStructureQueries.all, "employees"] as const,
			queryFn: () => getEmployeesForSalaryStructureOptionsFn(),
			staleTime: 5 * 60 * 1000,
		}),
	employeeSummary: (params: z.infer<typeof salaryStructureEmployeeSummarySchema>) =>
		queryOptions({
			queryKey: [...salaryStructureQueries.all, "employee-summary", params.employeeId] as const,
			queryFn: () => getSalaryStructureEmployeeSummaryFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	history: (params: z.infer<typeof salaryHistoryParamsSchema>) =>
		queryOptions({
			queryKey: [...salaryStructureQueries.all, "history", params.employeeId] as const,
			queryFn: () => getSalaryHistoryFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (params: z.infer<typeof salaryStructureDetailParamsSchema>) =>
		queryOptions({
			queryKey: [...salaryStructureQueries.all, "detail", params.structureId] as const,
			queryFn: () => getSalaryStructureByIdFn({ data: params }),
			staleTime: 60 * 1000,
		}),
};

export const payrollAccountMappingQueries = {
	all: ["payroll-account-mappings"] as const,
	list: () =>
		queryOptions({
			queryKey: [...payrollAccountMappingQueries.all, "list"] as const,
			queryFn: () => getAllAccountMappingsFn(),
			staleTime: 60 * 1000,
		}),
	accountOptions: () =>
		queryOptions({
			queryKey: [...payrollAccountMappingQueries.all, "account-options"] as const,
			queryFn: () => getPayrollMappingAccountOptionsFn(),
			staleTime: 5 * 60 * 1000,
		}),
};

export const statutoryRateQueries = {
	all: ["statutory-rates"] as const,
	current: () =>
		queryOptions({
			queryKey: [...statutoryRateQueries.all, "current"] as const,
			queryFn: () => getCurrentStatutoryRatesFn(),
			staleTime: 60 * 1000,
		}),
	history: (params: z.infer<typeof statutoryRateHistorySchema>) =>
		queryOptions({
			queryKey: [...statutoryRateQueries.all, "history", params.category] as const,
			queryFn: () => getStatutoryRateHistoryFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
};

export const overtimeQueries = {
	all: ["overtime-records"] as const,
	formOptions: () =>
		queryOptions({
			queryKey: [...overtimeQueries.all, "form-options"] as const,
			queryFn: () => getOvertimeFormOptionsFn(),
			staleTime: 5 * 60 * 1000,
		}),
	period: (filters: z.infer<typeof overtimeRecordPeriodSearchSchema>) =>
		queryOptions({
			queryKey: [...overtimeQueries.all, "period", filters] as const,
			queryFn: () => getOvertimeRecordsByPeriodFn({ data: filters }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (params: z.infer<typeof overtimeRecordByIdSchema>) =>
		queryOptions({
			queryKey: [...overtimeQueries.all, "detail", params.recordId] as const,
			queryFn: () => getOvertimeRecordDetailFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	employeePeriod: (params: z.infer<typeof overtimeRecordByEmployeePeriodSchema>) =>
		queryOptions({
			queryKey: [
				...overtimeQueries.all,
				"employee-period",
				params.employeeId,
				params.periodYear,
				params.periodMonth,
			] as const,
			queryFn: () => getOvertimeRecordForEmployeeFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	summary: (params: z.infer<typeof overtimeSummaryRangeSchema>) =>
		queryOptions({
			queryKey: [
				...overtimeQueries.all,
				"summary",
				params.employeeId,
				params.fromYear,
				params.fromMonth,
				params.toYear,
				params.toMonth,
			] as const,
			queryFn: () => getOvertimeSummaryForEmployeeFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
};

export const loanQueries = {
	all: ["employee-loans"] as const,
	list: (filters: z.infer<typeof allActiveLoansFilterSchema>) =>
		queryOptions({
			queryKey: [...loanQueries.all, "list", filters] as const,
			queryFn: () => getAllActiveLoansFn({ data: filters }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (params: z.infer<typeof loanByIdSchema>) =>
		queryOptions({
			queryKey: [...loanQueries.all, "detail", params.loanId] as const,
			queryFn: () => getLoanByIdFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	ledger: (params: z.infer<typeof loanByIdSchema>) =>
		queryOptions({
			queryKey: [...loanQueries.all, "ledger", params.loanId] as const,
			queryFn: () => getLoanLedgerFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	employee: (params: z.infer<typeof loansByEmployeeSchema>) =>
		queryOptions({
			queryKey: [
				...loanQueries.all,
				"employee",
				params.employeeId,
				params.statusFilter ?? "all",
			] as const,
			queryFn: () => getLoansByEmployeeFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	formOptions: () =>
		queryOptions({
			queryKey: [...loanQueries.all, "form-options"] as const,
			queryFn: () => getLoanFormOptionsFn(),
			staleTime: 5 * 60 * 1000,
		}),
};

export const salaryAdvanceQueries = {
	all: ["salary-advances"] as const,
	pending: () =>
		queryOptions({
			queryKey: [...salaryAdvanceQueries.all, "pending"] as const,
			queryFn: () => getAllPendingAdvancesFn(),
			staleTime: 60 * 1000,
		}),
	active: (filters: z.infer<typeof allActiveSalaryAdvancesFilterSchema>) =>
		queryOptions({
			queryKey: [...salaryAdvanceQueries.all, "active", filters] as const,
			queryFn: () => getAllActiveAdvancesFn({ data: filters }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (params: z.infer<typeof salaryAdvanceByIdSchema>) =>
		queryOptions({
			queryKey: [...salaryAdvanceQueries.all, "detail", params.advanceId] as const,
			queryFn: () => getAdvanceByIdFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	statement: (params: z.infer<typeof salaryAdvanceByIdSchema>) =>
		queryOptions({
			queryKey: [...salaryAdvanceQueries.all, "statement", params.advanceId] as const,
			queryFn: () => getAdvanceRecoveryStatementFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	employee: (params: z.infer<typeof salaryAdvancesByEmployeeSchema>) =>
		queryOptions({
			queryKey: [
				...salaryAdvanceQueries.all,
				"employee",
				params.employeeId,
				params.statusFilter ?? "all",
			] as const,
			queryFn: () => getAdvancesByEmployeeFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	formOptions: () =>
		queryOptions({
			queryKey: [...salaryAdvanceQueries.all, "form-options"] as const,
			queryFn: () => getSalaryAdvanceFormOptionsFn(),
			staleTime: 5 * 60 * 1000,
		}),
};

export const payrollPeriodQueries = {
	all: ["payroll-periods"] as const,
	list: (filters: z.infer<typeof payrollPeriodFiltersSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "list", filters] as const,
			queryFn: () => getAllPayrollPeriodsFn({ data: filters }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (params: z.infer<typeof payrollPeriodIdSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "detail", params.periodId] as const,
			queryFn: () => getPayrollPeriodByIdFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	journalSummary: (params: z.infer<typeof payrollPeriodIdSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "journal-summary", params.periodId] as const,
			queryFn: async () => {
				const result = await getPayrollJournalSummaryFn({ data: params });

				if (!result.success) {
					throw new Error(result.error.message);
				}

				return result.data;
			},
			staleTime: 60 * 1000,
		}),
	journalPostingOptions: () =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "journal-posting-options"] as const,
			queryFn: () => getPayrollJournalPostingOptionsFn(),
			staleTime: 5 * 60 * 1000,
		}),
	journalEntry: (journalEntryId: number) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "journal-entry", journalEntryId] as const,
			queryFn: async () => {
				const result = await getJournalEntryWithLinesFn({ data: { journalEntryId } });

				if (!result.success) {
					throw new Error(result.error.message);
				}

				return result.data;
			},
			staleTime: 60 * 1000,
		}),
	active: () =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "active"] as const,
			queryFn: () => getActivePayrollPeriodFn(),
			staleTime: 60 * 1000,
		}),
	remittance: (params: z.infer<typeof payrollPeriodIdSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "remittance", params.periodId] as const,
			queryFn: () => getPeriodRemittanceStatusFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	preflight: (params: z.infer<typeof payrollPeriodIdSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "preflight", params.periodId] as const,
			queryFn: () => runPayrollPeriodPreflightFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	ytd: (params: z.infer<typeof payrollPeriodYearSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "ytd", params.year] as const,
			queryFn: () => getYearToDateTotalsFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	bonuses: (params: z.infer<typeof payrollPeriodIdSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "bonuses", params.periodId] as const,
			queryFn: () => getPayrollPeriodBonusesFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	deductions: (params: z.infer<typeof payrollPeriodIdSchema>) =>
		queryOptions({
			queryKey: [...payrollPeriodQueries.all, "deductions", params.periodId] as const,
			queryFn: () => getPayrollPeriodOtherDeductionsFn({ data: params }),
			staleTime: 60 * 1000,
		}),
};

export const payrollSlipQueries = {
	all: ["payroll-slips"] as const,
	period: (params: z.infer<typeof payrollSlipPeriodSearchSchema>) =>
		queryOptions({
			queryKey: [...payrollSlipQueries.all, "period", params] as const,
			queryFn: () => getPayrollSlipsForPeriodFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (params: z.infer<typeof payrollSlipIdSchema>) =>
		queryOptions({
			queryKey: [...payrollSlipQueries.all, "detail", params.slipId] as const,
			queryFn: () => getPayrollSlipByIdFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	employeePeriod: (params: z.infer<typeof payrollSlipForEmployeeSchema>) =>
		queryOptions({
			queryKey: [
				...payrollSlipQueries.all,
				"employee-period",
				params.employeeId,
				params.payrollPeriodId,
			] as const,
			queryFn: () => getPayrollSlipForEmployeeFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	history: (params: z.infer<typeof employeePayrollHistorySchema>) =>
		queryOptions({
			queryKey: [
				...payrollSlipQueries.all,
				"history",
				params.employeeId,
				params.fromYear ?? "all",
				params.toYear ?? "all",
			] as const,
			queryFn: () => getEmployeePayrollHistoryFn({ data: params }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	departmentSummary: (params: z.infer<typeof payrollDepartmentSummarySchema>) =>
		queryOptions({
			queryKey: [...payrollSlipQueries.all, "department-summary", params.payrollPeriodId] as const,
			queryFn: () => getPayrollSummaryByDepartmentFn({ data: params }),
			staleTime: 60 * 1000,
		}),
	adjustmentOptions: (params: z.infer<typeof payrollPeriodAdjustmentOptionsSchema>) =>
		queryOptions({
			queryKey: [...payrollSlipQueries.all, "adjustments", params.payrollPeriodId] as const,
			queryFn: () => getPayrollAdjustmentOptionsFn({ data: params }),
			staleTime: 60 * 1000,
		}),
};
