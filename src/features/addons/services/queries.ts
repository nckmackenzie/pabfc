import { queryOptions } from "@tanstack/react-query";
import {
	getAddonById,
	getAddonInvoice,
	getAddons,
} from "@/features/addons/services/addons.api";

export const addonQueries = {
	all: ["addons"] as const,
	list: (filters?: { active?: boolean }) =>
		queryOptions({
			queryKey: [...addonQueries.all, "list", filters ?? null],
			queryFn: () => getAddons({ data: filters }),
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: [...addonQueries.all, "detail", id],
			queryFn: () => getAddonById({ data: id }),
		}),
	invoice: (id: string) =>
		queryOptions({
			queryKey: [...addonQueries.all, "invoice", id],
			queryFn: () => getAddonInvoice({ data: id }),
		}),
};
