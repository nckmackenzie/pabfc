import { useStore } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { useEffect } from "react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { getAccounts } from "@/features/coa/services/coa.api";
import { getPayees } from "@/features/expenses/services/payees.api";
import { ExpenseReportDataTable } from "@/features/reports/components/expense-report-datatable";
import { EXPENSES_REPORT_TYPE } from "@/features/reports/lib/constants";
import {
	type ExpenseValidateSchema,
	expenseReportFormSchema,
	expenseValidateSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/finance/expenses/")({
	component: RouteComponent,
	validateSearch: expenseValidateSchema,
	head: () => ({
		meta: [{ title: "Expenses Reports / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Expenses reports",
	},
	loader: async () => {
		const [accounts, payees] = await Promise.all([
			getAccounts({ data: {} }),
			getPayees(),
		]);

		return {
			accounts: accounts
				.filter(
					(account) =>
						account.type === "expense" && account.isPosting && account.isActive,
				)
				.map(({ id, name }) => ({
					value: String(id),
					label: name,
				})),
			payees: payees.map(({ id, name }) => ({
				value: id,
				label: toTitleCase(name),
			})),
		};
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Expenses Report"
				description="View detailed reports of expenses by date, account, or payee."
			/>
			<ReportFilters />
			{filters.dateRange?.from &&
				filters.dateRange?.to &&
				filters.reportType && (
					<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
						<ExpenseReportDataTable />
					</ErrorBoundaryWithSuspense>
				)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { accounts, payees } = Route.useLoaderData();
	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
			reportType: filters.reportType,
			accountId: filters.accountId,
			payeeId: filters.payeeId,
		} as ExpenseValidateSchema,
		validators: {
			onSubmit: expenseReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const [reportType] = useStore(form.store, (state) => [
		state.values.reportType,
	]);

	useEffect(() => {
		if (reportType === "all") {
			form.setFieldValue("accountId", undefined);
			form.setFieldValue("payeeId", undefined);
		} else if (reportType === "by-expense-account") {
			form.setFieldValue("payeeId", undefined);
		} else if (reportType === "by-payee") {
			form.setFieldValue("accountId", undefined);
		}
	}, [reportType, form]);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				<form.AppField name="dateRange">
					{(field) => <field.DateRangePicker asString label="Date Range" />}
				</form.AppField>
				<form.AppField name="reportType">
					{(field) => (
						<field.Select label="Report Type" placeholder="Select report type">
							{EXPENSES_REPORT_TYPE.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				{reportType === "by-expense-account" && (
					<form.AppField name="accountId">
						{(field) => (
							<field.Combobox
								items={accounts}
								placeholder="Select expense account"
								label="Expense Account"
							/>
						)}
					</form.AppField>
				)}
				{reportType === "by-payee" && (
					<form.AppField name="payeeId">
						{(field) => (
							<field.Select label="Payee" placeholder="Select payee">
								{payees.map((payee) => (
									<SelectItem key={payee.value} value={payee.value}>
										{payee.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
				)}
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
