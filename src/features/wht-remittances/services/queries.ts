import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getOutstandingWhtBills,
	getRemittance,
	getRemittanceNo,
	getRemittances,
} from "@/features/wht-remittances/services/wht-remittances.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const remittanceQueries = {
	all: ["wht-remittances"] as const,
	remittanceNo: () =>
		queryOptions({
			queryKey: [...remittanceQueries.all, "remittanceNo"],
			queryFn: () => getRemittanceNo(),
		}),
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...remittanceQueries.all, "list", filters],
			queryFn: () => getRemittances({ data: filters }),
		}),
	detail: (remittanceId: string) =>
		queryOptions({
			queryKey: [...remittanceQueries.all, "detail", remittanceId],
			queryFn: () => getRemittance({ data: remittanceId }),
		}),
	outstandingBills: () =>
		queryOptions({
			queryKey: [...remittanceQueries.all, "outstanding-bills"],
			queryFn: () => getOutstandingWhtBills(),
			// Balances move whenever a bill is posted or another remittance is made.
			staleTime: 0,
		}),
};
