import { queryOptions } from "@tanstack/react-query";
import { getAvailableGuestPassPlansFn } from "@/features/receipts/services/guest-pass.api";

export const guestPassQueries = {
	all: ["receipts", "guest-pass"] as const,
	availablePlans: () =>
		queryOptions({
			queryKey: [...guestPassQueries.all, "available-plans"],
			queryFn: () => getAvailableGuestPassPlansFn(),
		}),
};
