import { useStore } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { getMembers } from "@/features/members/services/members.queries.api";
import { AttendanceReportTable } from "@/features/reports/components/attendance-report-table";
import { ATTENDANCE_REPORT_TYPE } from "@/features/reports/lib/constants";
import {
	type AttendanceReportFormSchema,
	attendanceReportFormSchema,
	attendanceReportValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/attendance/")({
	component: RouteComponent,
	validateSearch: attendanceReportValidateSearchSchema,
	head: () => ({
		meta: [{ title: "Attendance Report / Prime Age Beauty & Fitness Center" }],
	}),
	beforeLoad: async () => {
		await requirePermission("attendance:view");
	},
	staticData: {
		breadcrumb: "Attendance report",
	},
	loader: async () => {
		const members = await getMembers({ data: {} });
		return {
			members: members.map(({ id, fullName }) => ({
				value: id,
				label: toTitleCase(fullName),
			})),
		};
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const hasRequiredFilters =
		Boolean(filters.asOfDate && filters.reportType) &&
		(filters.reportType === "all" ||
			(filters.reportType === "by-member" && Boolean(filters.memberId)));

	return (
		<Wrapper size="full">
			<PageHeader
				title="Attendance Report"
				description="View attendance sessions with member payment and duration metrics."
			/>
			<ReportFilters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<AttendanceReportTable
						filters={filters as AttendanceReportFormSchema}
					/>
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { members } = Route.useLoaderData();
	const form = useAppForm({
		defaultValues: {
			asOfDate: filters.asOfDate,
			reportType: filters.reportType,
			memberId: filters.memberId,
		} as AttendanceReportFormSchema,
		validators: {
			onSubmit: attendanceReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const reportType = useStore(form.store, (state) => state.values.reportType);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				<form.AppField name="asOfDate">
					{(field) => <field.Input type="date" label="As of Date" />}
				</form.AppField>
				<form.AppField name="reportType">
					{(field) => (
						<field.Select label="Report Type" placeholder="Select report type">
							{ATTENDANCE_REPORT_TYPE.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="memberId">
					{(field) => (
						<field.Combobox
							items={members}
							placeholder="Select member"
							label="Member"
							disabled={reportType !== "by-member"}
						/>
					)}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton
					buttonText="Preview"
					icon={<FileIcon />}
					withReset={false}
				/>
			</form.AppForm>
		</form>
	);
}
