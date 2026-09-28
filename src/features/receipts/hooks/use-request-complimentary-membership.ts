import { useMutation } from "@tanstack/react-query";
import { requestComplimentaryMembershipFn } from "@/features/receipts/services/complimentary.mutations.api";
import type { ComplimentaryRequestSchema } from "@/features/receipts/services/complimentary.schemas";

export function useRequestComplimentaryMembership() {
	return useMutation({
		mutationKey: ["complimentary-membership", "request"],
		mutationFn: async (input: ComplimentaryRequestSchema) => {
			return await requestComplimentaryMembershipFn({ data: input });
		},
	});
}
