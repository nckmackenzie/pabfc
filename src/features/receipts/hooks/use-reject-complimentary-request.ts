import { useMutation } from "@tanstack/react-query";
import { rejectComplimentaryRequestFn } from "@/features/receipts/services/complimentary.mutations.api";
import type { RejectComplimentaryRequestSchema } from "@/features/receipts/services/complimentary.schemas";

export function useRejectComplimentaryRequest() {
	return useMutation({
		mutationKey: ["complimentary-membership", "reject"],
		mutationFn: async (input: RejectComplimentaryRequestSchema) => {
			return await rejectComplimentaryRequestFn({ data: input });
		},
	});
}
