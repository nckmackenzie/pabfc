import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getEmployee,
	getEmployees,
	getNextEmployeeNo,
} from "@/features/employees/services/employees.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const employeeQueries = {
	all: ["employees"] as const,
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...employeeQueries.all, "list", { filters }] as const,
			queryFn: () => getEmployees({ data: { q: filters.q } }),
			placeholderData: keepPreviousData,
			staleTime: 60 * 1000,
		}),
	detail: (employeeId: string) =>
		queryOptions({
			queryKey: [...employeeQueries.all, "detail", employeeId] as const,
			queryFn: () => getEmployee({ data: employeeId }),
		}),
	nextEmployeeNo: () =>
		queryOptions({
			queryKey: [...employeeQueries.all, "next-employee-no"] as const,
			queryFn: () => getNextEmployeeNo(),
		}),
};
