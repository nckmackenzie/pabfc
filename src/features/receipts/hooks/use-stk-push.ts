// src/hooks/useStkPush.ts
import { useMutation } from "@tanstack/react-query";
import { initiateStkPushFn } from "@/features/receipts/services/payment.mutations.api";
import type { PaymentSchema } from "@/features/receipts/services/schemas";

export function useStkPush() {
	return useMutation({
		mutationKey: ["mpesa", "stkPush"],
		mutationFn: async (input: PaymentSchema) => {
			return await initiateStkPushFn({ data: input });
		},
	});
}
