import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ComboBox } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-range";
import { Search } from "@/components/ui/search";
import {
	ENQUIRY_SOURCE_OPTIONS,
	ENQUIRY_STATUS_OPTIONS,
	FOLLOW_UP_FILTER_OPTIONS,
} from "@/features/enquiries/lib/constants";
import { useFilters } from "@/hooks/use-filters";

const statusItems = [{ value: "all", label: "All Status" }, ...ENQUIRY_STATUS_OPTIONS];
const sourceItems = [{ value: "all", label: "All Sources" }, ...ENQUIRY_SOURCE_OPTIONS];

export function EnquiryFilters() {
	const route = getRouteApi("/app/enquiries/");
	const { employees } = route.useLoaderData();
	const { filters, setFilters, resetFilters } = useFilters(route.id);

	const staffItems = useMemo(
		() => [
			{ value: "all", label: "All Staff" },
			...employees.map(({ id, name }) => ({ value: id, label: name })),
		],
		[employees]
	);

	// Memoised: DatePicker resets its internal state whenever this identity changes.
	const dateRange = useMemo(
		() =>
			filters.from && filters.to
				? { from: parseISO(filters.from), to: parseISO(filters.to) }
				: undefined,
		[filters.from, filters.to]
	);

	const hasActiveFilters = Boolean(
		filters.q ||
		(filters.status && filters.status !== "all") ||
		(filters.source && filters.source !== "all") ||
		(filters.assignedEmployeeId && filters.assignedEmployeeId !== "all") ||
		(filters.followUp && filters.followUp !== "all") ||
		filters.from ||
		filters.to
	);

	return (
		<div className="space-y-3">
			<div className="grid md:grid-cols-3 gap-3">
				<Search
					placeholder="Search name, phone or email..."
					onHandleSearch={(value) => setFilters({ q: value })}
					defaultValue={filters.q}
				/>
				<ComboBox
					items={statusItems}
					value={filters.status ?? "all"}
					onChange={(value) => setFilters({ status: value || "all" })}
					placeholder="Select Status...."
				/>
				<ComboBox
					items={sourceItems}
					value={filters.source ?? "all"}
					onChange={(value) => setFilters({ source: value || "all" })}
					placeholder="Select Source...."
				/>
				<ComboBox
					items={staffItems}
					value={filters.assignedEmployeeId ?? "all"}
					onChange={(value) => setFilters({ assignedEmployeeId: value || "all" })}
					placeholder="Assigned staff...."
				/>
				<ComboBox
					items={FOLLOW_UP_FILTER_OPTIONS}
					value={filters.followUp ?? "all"}
					onChange={(value) => setFilters({ followUp: value || "all" })}
					placeholder="Follow-up...."
				/>
				<DatePicker
					initialDateRange={dateRange}
					onDateChange={({ from, to }) =>
						setFilters({
							from: from ? format(from, "yyyy-MM-dd") : undefined,
							to: to ? format(to, "yyyy-MM-dd") : undefined,
						})
					}
					onReset={() => setFilters({ from: undefined, to: undefined })}
				/>
			</div>
			{hasActiveFilters && (
				<Button type="button" variant="ghost" size="sm" onClick={() => resetFilters()}>
					Clear filters
				</Button>
			)}
		</div>
	);
}
