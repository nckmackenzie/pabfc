import { getRouteApi } from "@tanstack/react-router";
import { ComboBox } from "@/components/ui/custom-select";
import { Label } from "@/components/ui/label";
import { Search } from "@/components/ui/search";
import { SearchSelect } from "@/components/ui/search-select";
import { useFilters } from "@/hooks/use-filters";

const statusOptions = [
	{
		value: "all",
		label: "All",
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
	const { filters, setFilters } = useFilters(getRouteApi("/app/members/").id);
	return (
		<div className="grid md:grid-cols-3 gap-3">
			<div className="flex flex-col gap-2">
				<Label>Search</Label>
				<Search
					placeholder="Search members..."
					onHandleSearch={(value) => setFilters({ q: value })}
					defaultValue={filters.q}
				/>
			</div>
			<SearchSelect
				options={statusOptions}
				value={filters.status}
				onChange={(value) => setFilters({ status: value })}
			/>
			{/* <SearchSelect
				options={statusOptions}
				value={undefined}
				onChange={(value) => setFilters({ status: value })}
			/> */}
		</div>
	);
}
