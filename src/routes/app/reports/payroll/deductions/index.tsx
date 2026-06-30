import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { PayrollDeductionsReport } from "@/features/reports/components/payroll-deductions-report";
import { getEligiblePayrollPeriods } from "@/features/reports/services/payroll-reports-common.api";
import {
	payrollPeriodReportFormSchema,
	payrollPeriodReportValidateSearchSchema,
	type PayrollPeriodReportFormSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/payroll/deductions/")({
	beforeLoad: async () => {
		await requirePermission("payroll-periods:view");
		await requirePermission("employees:payroll-information");
	},
	component: RouteComponent,
	validateSearch: payrollPeriodReportValidateSearchSchema,
	loader: async () => getEligiblePayrollPeriods(),
	head: () => ({
		meta: [{ title: "Payroll Deductions Report / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Payroll Deductions Report",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const periods = Route.useLoaderData();
	const hasRequiredFilters = Boolean(filters.payrollPeriodId);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Payroll Deductions Report"
				description="Statutory and voluntary deductions grouped by type for a selected period."
			/>
			{periods.length === 0 ? (
				<EmptyState
					title="No eligible periods"
					description="Deductions reports are available for periods in paid or closed status."
				/>
			) : (
				<>
					<ReportFilters periods={periods} />
					{hasRequiredFilters && (
						<ErrorBoundaryWithSuspense key={filters.payrollPeriodId}>
							<PayrollDeductionsReport />
						</ErrorBoundaryWithSuspense>
					)}
				</>
			)}
		</Wrapper>
	);
}

function ReportFilters({
	periods,
}: {
	periods: Array<{ value: string; label: string; status: string }>;
}) {
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			payrollPeriodId: filters.payrollPeriodId,
		} as PayrollPeriodReportFormSchema,
		validators: {
			onSubmit: payrollPeriodReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
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
				<form.AppField name="payrollPeriodId">
					{(field) => (
						<field.Select label="Payroll Period" placeholder="Select period">
							{periods.map((period) => (
								<SelectItem key={period.value} value={period.value}>
									{period.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton buttonText="Preview" icon={<FileIcon />} withReset={false} />
			</form.AppForm>
		</form>
	);
}
