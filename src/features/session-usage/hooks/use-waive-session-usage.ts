import { useMutation } from "@tanstack/react-query";
import { waiveSessionUsageFn } from "@/features/session-usage/services/session-usage.mutations.api";
import type { WaiveSessionUsageSchema } from "@/features/session-usage/services/schemas";

export function useWaiveSessionUsage() {
	return useMutation({
		mutationKey: ["session-usage", "waive"],
		mutationFn: async (input: WaiveSessionUsageSchema) => {
			return await waiveSessionUsageFn({ data: input });
		},
	});
}
