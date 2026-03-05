import { useStore } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { MembersReportTable } from "@/features/reports/components/members-report-table";
import {
	MEMBERS_REPORT_TYPE,
	MEMBERS_STATUS_REPORT_FILTER,
} from "@/features/reports/lib/constants";
import {
	type MembersReportFormSchema,
	membersReportFormSchema,
	membersReportValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/members/")({
	component: RouteComponent,
	validateSearch: membersReportValidateSearchSchema,
	head: () => ({
		meta: [{ title: "Members Report / Prime Age Beauty & Fitness Center" }],
	}),
	beforeLoad: async () => {
		await requirePermission("members:view");
	},
	staticData: {
		breadcrumb: "Members report",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const hasRequiredFilters =
		Boolean(filters.asOfDate && filters.reportType) &&
		(filters.reportType === "all" ||
			(filters.reportType === "by-status" && Boolean(filters.status)));

	return (
		<Wrapper size="full">
			<PageHeader
				title="Members Report"
				description="View member listings by status and lifecycle metrics."
			/>
			<ReportFilters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<MembersReportTable filters={filters as MembersReportFormSchema} />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			asOfDate: filters.asOfDate,
			reportType: filters.reportType,
			status: filters.status,
		} as MembersReportFormSchema,
		validators: {
			onSubmit: membersReportFormSchema,
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
							{MEMBERS_REPORT_TYPE.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="status">
					{(field) => (
						<field.Select
							label="Status"
							placeholder="Select status"
							disabled={reportType !== "by-status"}
						>
							{MEMBERS_STATUS_REPORT_FILTER.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</field.Select>
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
