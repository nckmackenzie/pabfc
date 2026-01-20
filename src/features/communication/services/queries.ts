import { queryOptions } from "@tanstack/react-query";
import {
	getSmsBroadcasts,
	getSmsTemplates,
} from "@/features/communication/services/communication.api";

export const smsTemplateQueries = {
	all: ["sms-templates"] as const,
	list: () =>
		queryOptions({
			queryKey: [...smsTemplateQueries.all, "list"],
			queryFn: () => getSmsTemplates(),
		}),
};

export const smsBroadcastQueries = {
	all: ["sms-broadcasts"] as const,
	list: () =>
		queryOptions({
			queryKey: [...smsBroadcastQueries.all, "list"],
			queryFn: () => getSmsBroadcasts(),
		}),
};
