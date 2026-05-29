import { useMutation } from "@tanstack/react-query";
import { createManualMembershipPaymentFn } from "@/features/receipts/services/payment.mutations.api";
import type { PaymentSchema } from "@/features/receipts/services/schemas";

export function useManualMembershipPayment() {
	return useMutation({
		mutationKey: ["membership-payment", "manual"],
		mutationFn: async (input: PaymentSchema) => {
			return await createManualMembershipPaymentFn({ data: input });
		},
	});
}
