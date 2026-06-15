import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
	getEmployeesForSalaryStructureOptionsFn,
	getSalaryHistoryFn,
	getSalaryStructureByIdFn,
	getSalaryStructureDirectoryFn,
	getSalaryStructureEmployeeSummaryFn,
} from "@/features/payroll/services/salary-structures.api";
import type {
	salaryHistoryParamsSchema,
	salaryStructureDetailParamsSchema,
	salaryStructureDirectoryFilterSchema,
	salaryStructureEmployeeSummarySchema,
} from "@/features/payroll/services/schemas";
import { z } from "zod";

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
	employeeSummary: (
		params: z.infer<typeof salaryStructureEmployeeSummarySchema>,
	) =>
		queryOptions({
			queryKey: [
				...salaryStructureQueries.all,
				"employee-summary",
				params.employeeId,
			] as const,
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
