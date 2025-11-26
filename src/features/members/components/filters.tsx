import { getRouteApi } from "@tanstack/react-router";
import { ComboBox } from "@/components/ui/custom-select";
import { Search } from "@/components/ui/search";
import { useFilters } from "@/hooks/use-filters";

const statusOptions = [
	{
		value: "all",
		label: "All Status",
	},
	{
		value: "active",
		label: "Active",
	},
	{
		value: "inactive",
		label: "Inactive",
	},
	{
		value: "frozen",
		label: "Frozen",
	},
	{
		value: "terminated",
		label: "Terminated",
	},
];

export function MemberFilters() {
	const route = getRouteApi("/app/members/");
	const { plans } = route.useLoaderData();
	const { filters, setFilters } = useFilters(route.id);

	return (
		<div className="grid md:grid-cols-3 gap-3">
			<Search
				placeholder="Search members..."
				onHandleSearch={(value) => setFilters({ q: value })}
				defaultValue={filters.q}
			/>
			<ComboBox
				items={statusOptions}
				value={filters.status ?? "all"}
				onChange={(value) => setFilters({ status: value })}
				placeholder="Select Status...."
			/>
			<ComboBox
				items={[{ value: "all", label: "All Plans" }, ...plans]}
				value={filters.plan ?? "all"}
				onChange={(value) => setFilters({ plan: value })}
				placeholder="Select Plan...."
			/>
		</div>
	);
}
