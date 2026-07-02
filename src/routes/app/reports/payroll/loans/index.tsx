import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { LOAN_STATUS_OPTIONS } from "@/features/payroll/lib/loan-options";
import { PayrollLoanLedgerReport } from "@/features/reports/components/payroll-loan-ledger-report";
import { getLoanLedgerReportOptions } from "@/features/reports/services/loan-ledger-report.api";
import {
	type LoanLedgerReportFormSchema,
	loanLedgerReportFormSchema,
	loanLedgerReportValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/payroll/loans/")({
	beforeLoad: async () => {
		await requirePermission("employees:payroll-information");
		await requirePermission("employee-loans:view");
	},
	component: RouteComponent,
	validateSearch: loanLedgerReportValidateSearchSchema,
	loader: async () => getLoanLedgerReportOptions(),
	head: () => ({
		meta: [{ title: "Loan Ledger Report / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Loan Ledger",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Loan Ledger Report"
				description="Review all employee loans and drill into a full repayment statement for each loan."
			/>
			<ReportFilters />
			<ErrorBoundaryWithSuspense
				key={`${filters.employeeId ?? "all"}-${filters.status ?? "all"}`}
			>
				<PayrollLoanLedgerReport />
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
			status: filters.status ?? "all",
		} as LoanLedgerReportFormSchema,
		validators: {
			onSubmit: loanLedgerReportFormSchema,
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
				<form.AppField name="employeeId">
					{(field) => (
						<field.Combobox items={employees} placeholder="All employees" label="Employee" />
					)}
				</form.AppField>
				<form.AppField name="status">
					{(field) => (
						<field.Select label="Status" placeholder="All statuses">
							<SelectItem value="all">All statuses</SelectItem>
							{LOAN_STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
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
