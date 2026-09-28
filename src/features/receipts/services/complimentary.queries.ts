import { queryOptions } from "@tanstack/react-query";
import {
	getComplimentaryRequestByPaymentId,
	getComplimentaryRequests,
} from "@/features/receipts/services/complimentary.queries.api";
import type { ComplimentaryRequestsSearchSchema } from "@/features/receipts/services/complimentary.schemas";

export const complimentaryQueries = {
	all: ["complimentary-membership-requests"] as const,
	list: (filters: ComplimentaryRequestsSearchSchema) =>
		queryOptions({
			queryKey: [...complimentaryQueries.all, "list", filters],
			queryFn: () => getComplimentaryRequests({ data: filters }),
			refetchInterval: 30_000,
		}),
	byPaymentId: (paymentId: string) =>
		queryOptions({
			queryKey: [...complimentaryQueries.all, "by-payment", paymentId],
			queryFn: () => getComplimentaryRequestByPaymentId({ data: paymentId }),
		}),
};
