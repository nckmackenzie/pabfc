import { queryOptions } from "@tanstack/react-query";
import { getSettings } from "@/features/settings/services/settings.api";

export const settingsQuery = () =>
	queryOptions({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	});
