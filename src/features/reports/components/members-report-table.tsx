import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getMembersReport } from "@/features/reports/services/members-report.api";
import type { MembersReportFormSchema } from "@/features/reports/services/schema";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type MembersReportItem = Awaited<ReturnType<typeof getMembersReport>>[number];

export function MembersReportTable({
	filters,
}: {
	filters: MembersReportFormSchema;
}) {
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "members", filters],
		queryFn: () => getMembersReport({ data: filters }),
	});

	const totalPayments = data.reduce(
		(acc, row) => acc + toNumber(row.totalPayments),
		0,
	);

	const columns = getColumns({
		reportType: filters.reportType,
		status: filters.status,
		asOfDate: filters.asOfDate,
	});

	return (
		<DataTable
			data={data}
			columns={columns}
			customFooter={
				<>
					<TableCell
						colSpan={columns.length - 1}
						className="font-semibold text-right"
					>
						Total Payments
					</TableCell>
					<TableCell className="font-semibold text-right">
						{currencyFormatter(totalPayments, false)}
					</TableCell>
				</>
			}
			exportToExcel
		/>
	);
}

function getColumns({
	reportType,
	status,
	asOfDate,
}: {
	reportType: MembersReportFormSchema["reportType"];
	status: MembersReportFormSchema["status"];
	asOfDate: string;
}): Array<ColumnDef<MembersReportItem>> {
	if (reportType === "by-status" && status === "active") {
		return activeStatusColumns(asOfDate);
	}

	if (reportType === "by-status" && status === "inactive") {
		return inactiveStatusColumns(asOfDate);
	}

	return allMembersColumns(asOfDate);
}

function allMembersColumns(
	asOfDate: string,
): Array<ColumnDef<MembersReportItem>> {
	return [
		{
			accessorKey: "fullName",
			header: "Member Name",
			cell: ({ row }) => toTitleCase(row.original.fullName),
		},
		{
			accessorKey: "memberStatus",
			header: "Status",
			cell: ({ row }) => toTitleCase(row.original.memberStatus),
		},
		{
			accessorKey: "dateJoined",
			header: "Date Joined",
			cell: ({ row }) => dateFormat(row.original.dateJoined, "regular"),
		},
		{
			accessorKey: "lastVisit",
			header: "Last Visit",
			cell: ({ row }) =>
				row.original.lastVisit
					? dateFormat(row.original.lastVisit, "regular")
					: "-",
		},
		{
			id: "plan",
			header: "Plan",
			cell: ({ row }) => {
				const plan =
					row.original.memberStatus === "inactive"
						? row.original.lastPlanName
						: row.original.activePlanName;
				return plan ? toTitleCase(plan) : "-";
			},
		},
		{
			accessorKey: "contact",
			header: "Contact",
		},
		{
			accessorKey: "memberNo",
			header: "Member No",
		},
		{
			accessorKey: "gender",
			header: "Gender",
			cell: ({ row }) => toTitleCase(row.original.gender),
		},
		{
			accessorKey: "totalPayments",
			header: () => <div className="text-right">Total Payments</div>,
			cell: ({ row }) => (
				<div className="text-right">
					{currencyFormatter(row.original.totalPayments, false)}
				</div>
			),
		},
		{
			id: "duration",
			header: "Duration",
			cell: ({ row }) => getMembershipDuration(row.original, asOfDate),
		},
	];
}

function activeStatusColumns(
	asOfDate: string,
): Array<ColumnDef<MembersReportItem>> {
	return [
		{
			accessorKey: "memberNo",
			header: "Member No",
		},
		{
			accessorKey: "fullName",
			header: "Full Name",
			cell: ({ row }) => toTitleCase(row.original.fullName),
		},
		{
			accessorKey: "contact",
			header: "Contact",
		},
		{
			accessorKey: "gender",
			header: "Gender",
			cell: ({ row }) => toTitleCase(row.original.gender),
		},
		{
			accessorKey: "memberStatus",
			header: "Status",
			cell: ({ row }) => toTitleCase(row.original.memberStatus),
		},
		{
			accessorKey: "activePlanName",
			header: "Active Plan",
			cell: ({ row }) =>
				row.original.activePlanName
					? toTitleCase(row.original.activePlanName)
					: "-",
		},
		{
			accessorKey: "nextRenewalDate",
			header: "Next Renewal Date",
			cell: ({ row }) =>
				row.original.nextRenewalDate
					? dateFormat(row.original.nextRenewalDate, "regular")
					: "-",
		},
		{
			accessorKey: "lastVisit",
			header: "Last Visit",
			cell: ({ row }) =>
				row.original.lastVisit
					? dateFormat(row.original.lastVisit, "regular")
					: "-",
		},
		{
			accessorKey: "emergencyContactName",
			header: "Emergency Contact",
			cell: ({ row }) =>
				row.original.emergencyContactName
					? toTitleCase(row.original.emergencyContactName)
					: "-",
		},
		{
			accessorKey: "emergencyContactNo",
			header: "Emergency Contact No",
			cell: ({ row }) => row.original.emergencyContactNo ?? "-",
		},
		{
			accessorKey: "completedRegistration",
			header: "Completed Registration",
			cell: ({ row }) => (row.original.completedRegistration ? "Yes" : "No"),
		},
		{
			accessorKey: "banned",
			header: "Banned",
			cell: ({ row }) => (row.original.banned ? "Yes" : "No"),
		},
		{
			accessorKey: "dateJoined",
			header: "Date Joined",
			cell: ({ row }) => dateFormat(row.original.dateJoined, "regular"),
		},
		{
			accessorKey: "totalPayments",
			header: () => <div className="text-right">Total Payments</div>,
			cell: ({ row }) => (
				<div className="text-right">
					{currencyFormatter(row.original.totalPayments, false)}
				</div>
			),
		},
		{
			id: "duration",
			header: "Duration",
			cell: ({ row }) => getMembershipDuration(row.original, asOfDate),
		},
	];
}

function inactiveStatusColumns(
	asOfDate: string,
): Array<ColumnDef<MembersReportItem>> {
	return [
		{
			accessorKey: "fullName",
			header: "Name",
			cell: ({ row }) => toTitleCase(row.original.fullName),
		},
		{
			accessorKey: "contact",
			header: "Contact",
		},
		{
			accessorKey: "lastPlanName",
			header: "Last Plan",
			cell: ({ row }) =>
				row.original.lastPlanName
					? toTitleCase(row.original.lastPlanName)
					: "-",
		},
		{
			accessorKey: "lastAttendance",
			header: "Last Attendance",
			cell: ({ row }) =>
				row.original.lastAttendance
					? dateFormat(row.original.lastAttendance, "regular")
					: "-",
		},
		{
			accessorKey: "memberNo",
			header: "Member No",
		},
		{
			accessorKey: "totalPayments",
			header: () => <div className="text-right">Total Payments</div>,
			cell: ({ row }) => (
				<div className="text-right">
					{currencyFormatter(row.original.totalPayments, false)}
				</div>
			),
		},
		{
			id: "duration",
			header: "Duration",
			cell: ({ row }) => getMembershipDuration(row.original, asOfDate),
		},
	];
}

function getMembershipDuration(
	row: MembersReportItem,
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
