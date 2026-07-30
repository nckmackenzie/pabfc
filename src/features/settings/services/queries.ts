import { queryOptions } from "@tanstack/react-query";
import {
	getLateUpgradeGraceDaysDefault,
	getSettings,
} from "@/features/settings/services/settings.api";

export const settingsQuery = () =>
	queryOptions({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	});

export const lateUpgradeGraceDaysDefaultQuery = () =>
	queryOptions({
		queryKey: ["settings", "late-upgrade-grace-days-default"],
		queryFn: () => getLateUpgradeGraceDaysDefault(),
	});
