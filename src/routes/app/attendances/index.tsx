import { createFileRoute } from "@tanstack/react-router";
import { BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { DatePicker } from "@/components/ui/date-range";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { Search } from "@/components/ui/search";
import { AttendanceTable } from "@/features/attendances/components/attendance-table";
import { attendanceValidateSearch } from "@/features/attendances/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/attendances/")({
	beforeLoad: async () => {
		await requirePermission("attendance:view");
	},
	validateSearch: attendanceValidateSearch,
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Attendance / Prime Age Beauty & Fitness Centre" }],
	}),
	staticData: {
		breadcrumb: "Attendance",
	},
	pendingComponent: () => <BasePageLoadingSkeleton />,
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper permissions={["attendance:view"]}>
			<PageHeader
				title="Attendance"
				description="View member attendance records"
			/>
			<Filters />
			<AttendanceTable />
		</ProtectedPageWithWrapper>
	);
}

function Filters() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<div className="flex flex-col md:flex-row gap-4">
			<Search
				placeholder="Search attendance....."
				defaultValue={filters.q}
				onHandleSearch={(value) => {
					setFilters({ q: value.trim().length > 0 ? value.trim() : undefined });
				}}
			/>
			<DatePicker
				initialDateRange={{
					from: filters.from ? new Date(filters.from) : undefined,
					to: filters.to ? new Date(filters.to) : undefined,
				}}
				onDateChange={(dateRange) => {
					setFilters({
						from: dateRange?.from ? dateFormat(dateRange.from) : undefined,
						to: dateRange?.to ? dateFormat(dateRange.to) : undefined,
					});
				}}
				onReset={() => setFilters({ from: undefined, to: undefined })}
			/>
		</div>
	);
}
