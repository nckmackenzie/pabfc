import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import { getBillById, getBills } from "@/features/bills/services/bills.api";
import type { billValidateSearch } from "@/features/bills/services/schemas";
import { getVendors } from "@/features/bills/services/suppliers.api";
import { toTitleCase } from "@/lib/utils";

export const supplierQueries = {
	all: ["vendors"] as const,
	list: () =>
		queryOptions({
			queryKey: [...supplierQueries.all, "list"],
			queryFn: () => getVendors(),
		}),
	active: () =>
		queryOptions({
			queryKey: [...supplierQueries.all, "active"],
			queryFn: async () => {
				const vendors = await getVendors();
				return vendors
					.filter((vendor) => vendor.active)
					.map(({ id, name }) => ({ value: id, label: toTitleCase(name) }));
			},
		}),
};

export const billQueries = {
	all: ["bills"] as const,
	list: (filters?: z.infer<typeof billValidateSearch>) =>
		queryOptions({
			queryKey: [...billQueries.all, "list", filters],
			queryFn: () => getBills({ data: filters }),
		}),
	detail: (billId: string) =>
		queryOptions({
			queryKey: [...billQueries.all, "detail", billId],
			queryFn: () => getBillById({ data: billId }),
		}),
};
