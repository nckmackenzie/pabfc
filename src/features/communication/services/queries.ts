import { queryOptions } from "@tanstack/react-query";
import { getSmsTemplates } from "@/features/communication/services/communication.api";

export const smsTemplateQueries = {
	all: ["sms-templates"] as const,
	list: () =>
		queryOptions({
			queryKey: [...smsTemplateQueries.all, "list"],
			queryFn: () => getSmsTemplates(),
		}),
};
