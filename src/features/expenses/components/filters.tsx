import { getRouteApi } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-range";
import { Search } from "@/components/ui/search";
import { useFilters } from "@/hooks/use-filters";
import { dateFormat } from "@/lib/helpers";

export function ExpenseFilters() {
	const route = getRouteApi("/app/expenses/");
	const { filters, setFilters, resetFilters } = useFilters(route.id);
	return (
		<div className="flex flex-col md:flex-row md:items-center gap-4">
			<Search
				placeholder="Search"
				defaultValue={filters.q}
				onHandleSearch={(val) => setFilters({ q: val })}
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
			<Button
				variant="secondary"
				onClick={() => resetFilters()}
				className="w-full md:w-fit"
				size="lg"
			>
				Clear Filters
			</Button>
		</div>
	);
}
