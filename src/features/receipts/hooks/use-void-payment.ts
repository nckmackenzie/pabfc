import { useMutation } from "@tanstack/react-query";
import { voidPaymentFn } from "@/features/receipts/services/payment.mutations.api";
import type { VoidPaymentSchema } from "@/features/receipts/services/schemas";

export function useVoidPayment() {
	return useMutation({
		mutationKey: ["membership-payment", "void"],
		mutationFn: async (input: VoidPaymentSchema) => {
			return await voidPaymentFn({ data: input });
		},
	});
}
