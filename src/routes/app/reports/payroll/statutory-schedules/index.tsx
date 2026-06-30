import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { StatutorySchedulesReport } from "@/features/reports/components/statutory-schedules-report";
import { getEligiblePayrollPeriods } from "@/features/reports/services/payroll-reports-common.api";
import {
	payrollPeriodReportFormSchema,
	payrollPeriodReportValidateSearchSchema,
	type PayrollPeriodReportFormSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/payroll/statutory-schedules/")({
	beforeLoad: async () => {
		await requirePermission("payroll-periods:view");
		await requirePermission("employees:payroll-information");
	},
	component: RouteComponent,
	validateSearch: payrollPeriodReportValidateSearchSchema,
	loader: async () => getEligiblePayrollPeriods(),
	head: () => ({
		meta: [{ title: "Statutory Schedules / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Statutory Schedules",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const periods = Route.useLoaderData();
	const hasRequiredFilters = Boolean(filters.payrollPeriodId);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Statutory Schedules"
				description="Per-period NSSF, SHIF, AHL and NITA schedules for statutory filing."
			/>
			{periods.length === 0 ? (
				<EmptyState
					title="No eligible periods"
					description="Statutory schedules are available for periods in paid or closed status."
				/>
			) : (
				<>
					<ReportFilters periods={periods} />
					{hasRequiredFilters && (
						<ErrorBoundaryWithSuspense key={filters.payrollPeriodId}>
							<StatutorySchedulesReport />
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
