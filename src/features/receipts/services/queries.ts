import { queryOptions } from "@tanstack/react-query";
import {
	getMembershipTaxType,
	getMembershipUpgradeInfo,
	getPayment,
	getPayments,
	getUpgradeContext,
} from "@/features/receipts/services/payments.queries.api";
import type { PaymentsSearchValidateSchema } from "@/features/receipts/services/schemas";

export const paymentsQueries = {
	all: ["receipts"] as const,
	list: (filters: PaymentsSearchValidateSchema) =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "list", filters],
			queryFn: () => getPayments({ data: filters }),
			refetchInterval: 30_000,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "detail", id],
			queryFn: () => getPayment({ data: id }),
		}),
	membershipTaxType: () =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "membership-tax-type"],
			queryFn: () => getMembershipTaxType(),
		}),
	upgradeContext: (id: string) =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "upgrade-context", id],
			queryFn: () => getUpgradeContext({ data: id }),
		}),
	upgradeInfo: (id: string) =>
		queryOptions({
			queryKey: [...paymentsQueries.all, "upgrade-info", id],
			queryFn: () => getMembershipUpgradeInfo({ data: id }),
		}),
};
