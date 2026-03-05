import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { getAttendanceReport } from "@/features/reports/services/attendance-report.api";
import type { AttendanceReportFormSchema } from "@/features/reports/services/schema";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type AttendanceReportItem = Awaited<
	ReturnType<typeof getAttendanceReport>
>[number];

export function AttendanceReportTable({
	filters,
}: {
	filters: AttendanceReportFormSchema;
}) {
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "attendance", filters],
		queryFn: () => getAttendanceReport({ data: filters }),
	});

	const columns = getColumns(filters.asOfDate, filters.reportType);

	return <DataTable data={data} columns={columns} exportToExcel />;
}

function getColumns(
	asOfDate: string,
	reportType: AttendanceReportFormSchema["reportType"],
): Array<ColumnDef<AttendanceReportItem>> {
	if (reportType === "by-member") {
		return byMemberColumns(asOfDate);
	}

	return allColumns(asOfDate);
}

function allColumns(asOfDate: string): Array<ColumnDef<AttendanceReportItem>> {
	return [
		{
			accessorKey: "memberName",
			header: "Member",
			cell: ({ row }) => toTitleCase(row.original.memberName),
		},
		{
			accessorKey: "memberNo",
			header: "Member No",
		},
		{
			accessorKey: "memberStatus",
			header: "Status",
			cell: ({ row }) => toTitleCase(row.original.memberStatus),
		},
		{
			accessorKey: "checkInTime",
			header: "Check In",
			cell: ({ row }) => dateFormat(row.original.checkInTime, "reporting"),
		},
		{
			accessorKey: "checkOutTime",
			header: "Check Out",
			cell: ({ row }) =>
				row.original.checkOutTime
					? dateFormat(row.original.checkOutTime, "reporting")
					: "-",
		},
		{
			accessorKey: "sessionDuration",
			header: "Session Duration",
			cell: ({ row }) => row.original.sessionDuration ?? "-",
		},
		{
			id: "duration",
			header: "Duration",
			cell: ({ row }) => getMembershipDuration(row.original, asOfDate),
		},
	];
}

function byMemberColumns(
	asOfDate: string,
): Array<ColumnDef<AttendanceReportItem>> {
	return [
		{
			accessorKey: "checkInTime",
			header: "Check In",
			cell: ({ row }) => dateFormat(row.original.checkInTime, "reporting"),
		},
		{
			accessorKey: "checkOutTime",
			header: "Check Out",
			cell: ({ row }) =>
				row.original.checkOutTime
					? dateFormat(row.original.checkOutTime, "reporting")
					: "-",
		},
		{
			accessorKey: "sessionDuration",
			header: "Session Duration",
			cell: ({ row }) => row.original.sessionDuration ?? "-",
		},
		{
			accessorKey: "memberStatus",
			header: "Status",
			cell: ({ row }) => toTitleCase(row.original.memberStatus),
		},
		{
			id: "duration",
			header: "Duration",
			cell: ({ row }) => getMembershipDuration(row.original, asOfDate),
		},
	];
}

function getMembershipDuration(
	row: AttendanceReportItem,
	asOfDate: string,
): string {
	const startDate = new Date(row.dateJoined);
	const endDate =
		row.memberStatus === "inactive" && row.lastAttendance
			? new Date(row.lastAttendance)
			: new Date(asOfDate);

	if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
		return "-";
	}

	if (endDate.getTime() <= startDate.getTime()) {
		return "0 days";
	}

	return formatElapsedDuration(startDate, endDate);
}

function formatElapsedDuration(startDate: Date, endDate: Date): string {
	const millis = endDate.getTime() - startDate.getTime();
	const totalDays = Math.floor(millis / (1000 * 60 * 60 * 24));
	const years = Math.floor(totalDays / 365);
	const months = Math.floor((totalDays % 365) / 30);
	const days = (totalDays % 365) % 30;

	const parts: Array<string> = [];
	if (years > 0) parts.push(`${years}y`);
	if (months > 0) parts.push(`${months}m`);
	if (days > 0 || parts.length === 0) parts.push(`${days}d`);

	return parts.join(" ");
}
