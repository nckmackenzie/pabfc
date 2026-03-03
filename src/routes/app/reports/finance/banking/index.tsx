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
import { getBanks } from "@/features/bankings/services/bankings.api";
import { BankingReportDataTable } from "@/features/reports/components/banking-report-datatable";
import {
	BANKING_REPORT_STATUS,
	BANKING_REPORT_TYPE,
} from "@/features/reports/lib/constants";
import {
	type BankingValidateSchema,
	bankingReportFormSchema,
	bankingValidateSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/finance/banking/")({
	beforeLoad: async () => {
		await requirePermission("reports:bankings-report");
	},
	component: RouteComponent,
	validateSearch: bankingValidateSchema,
	head: () => ({
		meta: [{ title: "Banking Report / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Banking report",
	},
	loader: async () => {
		const banks = await getBanks();
		return {
			banks: banks.map((bank) => ({
				value: bank.id,
				label: bank.bankName,
			})),
		};
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	const hasRequiredFilters =
		Boolean(filters.dateRange?.from && filters.dateRange?.to) &&
		Boolean(filters.bankId) &&
		(filters.reportType === "all" ||
			(filters.reportType === "by-status" && Boolean(filters.status)));

	return (
		<Wrapper size="full">
			<PageHeader
				title="Banking Report"
				description="View bank transactions by date range and status."
			/>
			<ReportFilters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<BankingReportDataTable />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { banks } = Route.useLoaderData();

	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
			bankId: filters.bankId,
			reportType: filters.reportType ?? "all",
			status: filters.status,
		} as BankingValidateSchema,
		validators: {
			onSubmit: bankingReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const reportType = useStore(form.store, (state) => state.values.reportType);

	useEffect(() => {
		if (reportType === "all") {
			form.setFieldValue("status", undefined);
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
			<FieldGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
				<form.AppField name="dateRange">
					{(field) => <field.DateRangePicker asString label="Date Range" />}
				</form.AppField>
				<form.AppField name="bankId">
					{(field) => (
						<field.Combobox
							items={banks}
							placeholder="Select bank"
							label="Bank"
						/>
					)}
				</form.AppField>
				<form.AppField name="reportType">
					{(field) => (
						<field.Select label="Report Type" placeholder="Select report type">
							{BANKING_REPORT_TYPE.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				{reportType === "by-status" && (
					<form.AppField name="status">
						{(field) => (
							<field.Select label="Status" placeholder="Select status">
								{BANKING_REPORT_STATUS.map((status) => (
									<SelectItem key={status.value} value={status.value}>
										{status.label}
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
