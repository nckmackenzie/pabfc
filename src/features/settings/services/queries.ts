import { queryOptions } from "@tanstack/react-query";
import {
	getBiotimeSettings,
	getSettings,
} from "@/features/settings/services/settings.api";

export const settingsQuery = () =>
	queryOptions({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	});

export const biotimeSettingsQuery = () =>
	queryOptions({
		queryKey: ["biotimeSettings"],
		queryFn: () => getBiotimeSettings(),
	});
