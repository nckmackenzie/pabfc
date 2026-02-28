import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { getReceiptReport } from "@/features/reports/services/receipt-report.api";
import type { ReceiptValidateSchema } from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";

export function ReceiptReportDataTable() {
	const { filters } = useFilters(
		getRouteApi("/app/reports/finance/receipts/").id,
	);
	const { data } = useSuspenseQuery({
		queryKey: ["payments", filters],
		queryFn: () => getReceiptReport({ data: filters as ReceiptValidateSchema }),
	});
	return (
		<div>
			<pre>{JSON.stringify(data, null, 2)}</pre>
		</div>
	);
}
