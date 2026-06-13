import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LEAVE_STATUS, LEAVE_TYPES } from "@/drizzle/schema";
import { LeaveRequestListFilters } from "../utils/schemas";
import { formatText } from "@/features/employees/utils/helpers";
import { Input } from "@/components/ui/input";

type LeaveRequestFiltersProps = {
	filters: LeaveRequestListFilters;
	setFilters: (filters: Partial<LeaveRequestListFilters>) => void;
	disableStatus?: boolean;
};

export function LeaveRequestFilters({
	filters,
	setFilters,
	disableStatus = false,
}: LeaveRequestFiltersProps) {
	return (
		<div className="grid gap-3 md:grid-cols-3">
			<Select
				value={filters.status ?? "all"}
				onValueChange={(value) =>
					setFilters({
						status:
							value === "all"
								? undefined
								: (value as LeaveRequestListFilters["status"]),
					})
				}
				disabled={disableStatus}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Filter by status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All statuses</SelectItem>
					{LEAVE_STATUS.map((status) => (
						<SelectItem key={status} value={status}>
							{formatText(status)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={filters.leaveType ?? "all"}
				onValueChange={(value) =>
					setFilters({
						leaveType:
							value === "all"
								? undefined
								: (value as LeaveRequestListFilters["leaveType"]),
					})
				}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Filter by leave type" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All leave types</SelectItem>
					{LEAVE_TYPES.map((leaveType) => (
						<SelectItem key={leaveType} value={leaveType}>
							{formatText(leaveType)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Input
				type="number"
				placeholder="Leave year"
				value={filters.year ?? ""}
				onChange={(event) =>
					setFilters({ year: Number(event.target.value) || undefined })
				}
				min={2000}
				max={9999}
			/>
		</div>
	);
}
