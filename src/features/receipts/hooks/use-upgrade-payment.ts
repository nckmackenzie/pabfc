import { useMutation } from "@tanstack/react-query";
import { upgradePaymentFn } from "@/features/receipts/services/payment.mutations.api";
import type { UpgradePaymentSchema } from "@/features/receipts/services/schemas";

export function useUpgradePayment() {
	return useMutation({
		mutationKey: ["membership-payment", "upgrade"],
		mutationFn: async (input: UpgradePaymentSchema) => {
			return await upgradePaymentFn({ data: input });
		},
	});
}
