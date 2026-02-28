import { useStore } from "@tanstack/react-form";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { ReceiptReportDataTable } from "@/features/reports/components/receipt-report-datatable";
import { RECEIPTS_REPORT_TYPE } from "@/features/reports/lib/constants";
import {
	type ReceiptValidateSchema,
	receiptReportFormSchema,
	receiptValidateSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";

export const Route = createFileRoute("/app/reports/finance/receipts/")({
	component: RouteComponent,
	validateSearch: receiptValidateSchema,
	head: () => ({
		meta: [{ title: "Receipts Reports / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Receipt reports",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	return (
		<Wrapper size="full">
			<PageHeader
				title="Receipts Report"
				description="View detailed reports of all payments received."
			/>
			<ReportFilters />
			{filters.dateRange?.from && filters.dateRange?.to && filters.reportType && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<ReceiptReportDataTable />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const members = useRouteContext({
		from: "/app/reports/finance",
		select: (state) => state.members,
	});
	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
			reportType: filters.reportType,
			memberId: filters.memberId,
		} as ReceiptValidateSchema,
		validators: {
			onSubmit: receiptReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const [reportType] = useStore(form.store, (state) => [
		state.values.reportType,
	]);

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
							{RECEIPTS_REPORT_TYPE.map((type) => (
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
