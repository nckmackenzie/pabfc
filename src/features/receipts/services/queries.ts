import { queryOptions } from "@tanstack/react-query";
import {
	getPayment,
	getPayments,
} from "@/features/receipts/services/payments.queries.api";
import type { PaymentsSearchValidateSchema } from "@/features/receipts/services/schemas";

export const paymentsQueries = {
	all: ["receipts"] as const,
	list: (filters: PaymentsSearchValidateSchema) =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "list", filters],
			queryFn: () => getPayments({ data: filters }),
			refetchInterval: 30_000,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "detail", id],
			queryFn: () => getPayment({ data: id }),
		}),
};
