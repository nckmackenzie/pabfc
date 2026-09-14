import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getGeneralLedger,
	getGeneralLedgerAccountOptions,
} from "@/features/reports/services/general-ledger.api";
import type { generalLedgerServerSchema } from "@/features/reports/services/schema";

export const generalLedgerQueries = {
	all: ["reports", "general-ledger"] as const,
	accountOptions: () =>
		queryOptions({
			queryKey: [...generalLedgerQueries.all, "account-options"],
			queryFn: () => getGeneralLedgerAccountOptions(),
		}),
	report: (filters: z.input<typeof generalLedgerServerSchema>) =>
		queryOptions({
			queryKey: [...generalLedgerQueries.all, "report", filters],
			queryFn: () => getGeneralLedger({ data: filters }),
			staleTime: 0,
		}),
};
