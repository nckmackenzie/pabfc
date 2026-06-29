import { useStore } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import {
	PayrollP9Report,
	PayrollP9ReportSkeleton,
} from "@/features/reports/components/payroll-p9-report";
import { getPayrollP9Options } from "@/features/reports/services/payroll-p9.api";
import {
	type PayrollP9ReportFormSchema,
	payrollP9ReportFormSchema,
	payrollP9ValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/payroll/p9/")({
	beforeLoad: async () => {
		await requirePermission("reports:payroll-p9");
		await requirePermission("employees:payroll-information");
		await requirePermission("payroll-periods:view");
	},
	component: RouteComponent,
	validateSearch: payrollP9ValidateSearchSchema,
	loader: async () => getPayrollP9Options(),
	head: () => ({
		meta: [{ title: "P9 Tax Certificate / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "P9 Tax Certificate",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const { employees } = Route.useLoaderData();
	const hasRequiredFilters = Boolean(filters.employeeId && filters.taxYear);

	return (
		<Wrapper size="full">
			<PageHeader
				title="P9 Tax Certificate"
				description="View annual payroll tax certificate totals by employee and tax year."
			/>
			{employees.length === 0 ? (
				<EmptyState
					title="No payroll report data yet"
					description="P9 reports become available after payroll periods are closed and slips exist for employees."
				/>
			) : (
				<>
					<ReportFilters />
					{hasRequiredFilters && (
						<ErrorBoundaryWithSuspense
							key={`${filters.employeeId}-${filters.taxYear}`}
							loader={<PayrollP9ReportSkeleton />}
						>
							<PayrollP9Report />
						</ErrorBoundaryWithSuspense>
					)}
				</>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { employees, employeeTaxYears } = Route.useLoaderData();
	const form = useAppForm({
		defaultValues: {
			employeeId: filters.employeeId,
			taxYear: filters.taxYear,
		} as PayrollP9ReportFormSchema,
		validators: {
			onSubmit: payrollP9ReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const employeeId = useStore(form.store, (state) => state.values.employeeId);
	const availableYears = employeeId ? employeeTaxYears[employeeId] ?? [] : [];

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				<form.AppField name="employeeId">
					{(field) => (
						<field.Combobox
							items={employees}
							placeholder="Select employee"
							label="Employee"
						/>
					)}
				</form.AppField>
				<form.AppField name="taxYear">
					{(field) => (
						<field.Select
							label="Tax Year"
							placeholder="Select tax year"
							disabled={!employeeId}
						>
							{availableYears.map((year) => (
								<SelectItem key={year} value={year.toString()}>
									{year}
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
