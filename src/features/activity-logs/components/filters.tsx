import { getRouteApi } from "@tanstack/react-router";
import { DatePicker } from "@/components/ui/date-range";
import { Search } from "@/components/ui/search";
import { useFilters } from "@/hooks/use-filters";
import { dateFormat } from "@/lib/helpers";

export function ActivityLogFilters() {
	const { filters, setFilters } = useFilters(
		getRouteApi("/app/activity-logs/").id,
	);
	return (
		<div className="grid md:grid-cols-3 gap-4">
			<Search
				placeholder="Search logs..."
				defaultValue={filters.q}
				onHandleSearch={(value) => setFilters({ q: value })}
			/>
			<DatePicker
				initialDateRange={{
					from: filters.from ? new Date(filters.from) : undefined,
					to: filters.to ? new Date(filters.to) : undefined,
				}}
				onDateChange={(dateRange) => {
					setFilters({
						from: dateRange.from ? dateFormat(dateRange.from) : undefined,
						to: dateRange.to ? dateFormat(dateRange.to) : undefined,
					});
				}}
				onReset={() => setFilters({ from: undefined, to: undefined })}
			/>
		</div>
	);
}
