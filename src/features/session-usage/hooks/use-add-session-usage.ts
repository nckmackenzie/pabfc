import { useMutation } from "@tanstack/react-query";
import { addSessionUsageFn } from "@/features/session-usage/services/session-usage.mutations.api";
import type { AddSessionUsageSchema } from "@/features/session-usage/services/schemas";

export function useAddSessionUsage() {
	return useMutation({
		mutationKey: ["session-usage", "add"],
		mutationFn: async (input: AddSessionUsageSchema) => {
			return await addSessionUsageFn({ data: input });
		},
	});
}
