import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getBillById,
	getBills,
	getUnpaidBillsBySupplier,
} from "@/features/bills/services/bills.api";
import type { billValidateSearch } from "@/features/bills/services/schemas";
import {
	getVendorById,
	getVendors,
} from "@/features/bills/services/suppliers.api";
import type { searchValidateSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";

export const supplierQueries = {
	all: ["vendors"] as const,
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...supplierQueries.all, "list", filters],
			queryFn: () => getVendors({ data: filters }),
		}),
	detail: (supplierId: string) =>
		queryOptions({
			queryKey: [...supplierQueries.all, "detail", supplierId],
			queryFn: () => getVendorById({ data: supplierId }),
		}),
	active: () =>
		queryOptions({
			queryKey: [...supplierQueries.all, "active"],
			queryFn: async () => {
				const vendors = await getVendors({ data: {} });
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
	pendingBillsBySupplier: (supplierId: string) =>
		queryOptions({
			queryKey: [...billQueries.all, "pending-bills", supplierId],
			queryFn: () => getUnpaidBillsBySupplier({ data: supplierId }),
			enabled: supplierId.trim().length > 0,
		}),
};
