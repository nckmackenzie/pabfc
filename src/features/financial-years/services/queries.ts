import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getFinancialYear,
	getFinancialYears,
} from "@/features/financial-years/services/financial-years.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const financialYearQueries = {
	all: ["financial-years"] as const,
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...financialYearQueries.all, "list", filters],
			queryFn: () => getFinancialYears({ data: filters }),
		}),
	detail: (financialYearId: string) =>
		queryOptions({
			queryKey: [...financialYearQueries.all, "detail", financialYearId],
			queryFn: () => getFinancialYear({ data: financialYearId }),
		}),
};
