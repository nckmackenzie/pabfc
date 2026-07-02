import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { SalaryAdvancesReportTable } from "@/features/reports/components/salary-advances-report";
import { SALARY_ADVANCE_STATUS_OPTIONS } from "@/features/payroll/lib/salary-advance-options";
import { getSalaryAdvanceReportOptions } from "@/features/reports/services/salary-advance-report.api";
import {
	type SalaryAdvanceReportFormSchema,
	salaryAdvanceReportFormSchema,
	salaryAdvanceReportValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/human-resources/salary-advances/")({
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("salary-advances:view");
	},
	component: RouteComponent,
	validateSearch: salaryAdvanceReportValidateSearchSchema,
	loader: async () => getSalaryAdvanceReportOptions(),
	head: () => ({
		meta: [{ title: "Salary Advances Report / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Salary Advances",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Salary Advance Report"
				description="Review all salary advances and drill into a full recovery statement for each advance."
			/>
			<ReportFilters />
			<ErrorBoundaryWithSuspense
				key={`${filters.employeeId ?? "all"}-${filters.status ?? "active"}`}
			>
				<SalaryAdvancesReportTable />
			</ErrorBoundaryWithSuspense>
		</Wrapper>
	);
}

function ReportFilters() {
	const { employees } = Route.useLoaderData();
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			employeeId: filters.employeeId,
			status: filters.status ?? "active",
		} as SalaryAdvanceReportFormSchema,
		validators: {
			onSubmit: salaryAdvanceReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters({
				employeeId: value.employeeId,
				status: value.status === "active" ? undefined : value.status,
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
			<FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				<form.AppField name="status">
					{(field) => (
						<field.Select label="Status" placeholder="Active states">
							<SelectItem value="active">Active states</SelectItem>
							<SelectItem value="all">All statuses</SelectItem>
							{SALARY_ADVANCE_STATUS_OPTIONS.filter((option) => option.value !== "approved").map(
								(option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								)
							)}
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
