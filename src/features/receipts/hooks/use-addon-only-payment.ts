import { useMutation } from "@tanstack/react-query";
import { createAddonOnlyPaymentFn } from "@/features/receipts/services/payment.mutations.api";
import type { AddonOnlyPaymentSchema } from "@/features/receipts/services/schemas";

export function useAddonOnlyPayment() {
	return useMutation({
		mutationKey: ["addon-payment", "manual"],
		mutationFn: async (input: AddonOnlyPaymentSchema) => {
			return await createAddonOnlyPaymentFn({ data: input });
		},
	});
}
