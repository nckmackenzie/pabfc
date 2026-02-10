// src/hooks/usePaymentStatus.ts
import { useQuery } from "@tanstack/react-query";
import { getPaymentStatusFn } from "../services/payments.queries.api";

export function usePaymentStatus(checkoutRequestId: string | null) {
	return useQuery({
		queryKey: ["mpesa", "status", checkoutRequestId],
		queryFn: () => getPaymentStatusFn({ data: checkoutRequestId as string }),
		enabled: !!checkoutRequestId,
		refetchInterval: 3000, // poll every 3 seconds
	});
}
