import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getPayment,
	getPaymentNo,
	getPayments,
} from "@/features/payments/services/payments.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const paymentQueries = {
	all: ["payments"] as const,
	paymentNo: () =>
		queryOptions({
			queryKey: [...paymentQueries.all, "paymentNo"],
			queryFn: () => getPaymentNo(),
		}),
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...paymentQueries.all, "list", filters],
			queryFn: () => getPayments({ data: filters }),
		}),
	detail: (paymentId: string) =>
		queryOptions({
			queryKey: [...paymentQueries.all, "detail", paymentId],
			queryFn: () => getPayment({ data: paymentId }),
		}),
};
