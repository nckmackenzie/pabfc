import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { LeaveUtilisationReportTable } from "@/features/reports/components/leave-utilisation-report";
import { getLeaveUtilisationReportOptions } from "@/features/reports/services/leave-utilisation-report.api";
import {
	type LeaveUtilisationReportFormSchema,
	leaveUtilisationReportFormSchema,
	leaveUtilisationValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

const currentYear = new Date().getFullYear();

export const Route = createFileRoute("/app/reports/human-resources/leave-utilisation/")({
	beforeLoad: async () => {
		await requirePermission("leaves:view");
	},
	component: RouteComponent,
	validateSearch: leaveUtilisationValidateSearchSchema,
	loader: async () => getLeaveUtilisationReportOptions(),
	head: () => ({
		meta: [{ title: "Leave Utilisation Report / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Leave Utilisation",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Leave Utilisation Report"
				description="Review per-employee leave entitlement usage and available balances for a selected leave year."
			/>
			<ReportFilters />
			<ErrorBoundaryWithSuspense
				key={`${filters.leaveYear ?? currentYear}-${filters.departmentId ?? "all"}-${filters.employeeId ?? "all"}`}
			>
				<LeaveUtilisationReportTable />
			</ErrorBoundaryWithSuspense>
		</Wrapper>
	);
}

function ReportFilters() {
	const { leaveYears, employees } = Route.useLoaderData();
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			leaveYear: String(filters.leaveYear ?? currentYear),
			departmentId: filters.departmentId ? String(filters.departmentId) : undefined,
			employeeId: filters.employeeId,
		} as LeaveUtilisationReportFormSchema,
		validators: {
			onSubmit: leaveUtilisationReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters({
				leaveYear: Number(value.leaveYear),
				departmentId: value.departmentId ? Number(value.departmentId) : undefined,
				employeeId: value.employeeId,
			});
		},
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
				<form.AppField name="leaveYear">
					{(field) => (
						<field.Select label="Leave Year" placeholder="Select leave year">
							{leaveYears.map((year) => (
								<SelectItem key={year} value={year.toString()}>
									{year}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>

				<form.AppField name="employeeId">
					{(field) => (
						<field.Combobox items={employees} placeholder="All employees" label="Employee" />
					)}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton buttonText="Preview" icon={<FileIcon />} withReset={false} />
			</form.AppForm>
		</form>
	);
}
