import { useStore } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { useEffect } from "react";
import type { z } from "zod";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { Wrapper } from "@/components/ui/wrapper";
import { supplierQueries } from "@/features/bills/services/queries";
import { InvoicesReportDataTable } from "@/features/reports/components/invoices-report-datatable";
import { INVOICES_REPORT_TYPE } from "@/features/reports/lib/constants";
import {
	invoiceReportFormSchema,
	invoiceValidateSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/finance/invoices/")({
	beforeLoad: async () => {
		await requirePermission("reports:invoices-report");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Invoices Report / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context: { queryClient } }) => {
		const vendors = await queryClient.ensureQueryData(supplierQueries.list({}));
		return {
			vendors: vendors.map(({ id, name }) => ({
				value: id,
				label: toTitleCase(name),
			})),
		};
	},
	validateSearch: invoiceValidateSchema,
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	const hasRequiredFilters =
		filters.reportType === "overdue" || filters.reportType === "ageing-summary"
			? true
			: Boolean(
					filters.reportType === "all" ||
						filters.reportType === "vendor-spend-summary",
				) &&
				Boolean(filters.dateRange?.from && filters.dateRange?.to) &&
				Boolean(filters.vendorId);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Invoices Report"
				description="View detailed reports of invoices."
			/>
			<Filters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<InvoicesReportDataTable />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function Filters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { vendors } = Route.useLoaderData();
	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
			reportType: filters.reportType ?? "all",
			vendorId: filters.vendorId,
		} as z.infer<typeof invoiceReportFormSchema>,
		validators: {
			onSubmit: invoiceReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const reportType = useStore(form.store, (state) => state.values.reportType);

	useEffect(() => {
		if (reportType === "overdue" || reportType === "ageing-summary") {
			form.setFieldValue("vendorId", undefined);
			form.setFieldValue("dateRange", undefined);
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
				<form.AppField name="reportType">
					{(field) => (
						<field.Select label="Report Type" placeholder="Select report type">
							{INVOICES_REPORT_TYPE.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									{type.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="dateRange">
					{(field) => (
						<field.DateRangePicker
							disabled={
								reportType === "overdue" || reportType === "ageing-summary"
							}
							asString
							label="Date Range"
						/>
					)}
				</form.AppField>
				<form.AppField name="vendorId">
					{(field) => (
						<field.Combobox
							items={
								reportType === "all"
									? [{ value: "all", label: "All Vendors" }, ...vendors]
									: reportType === "vendor-spend-summary"
										? vendors
										: []
							}
							placeholder="Select vendor"
							label="Vendor"
							disabled={
								reportType === "overdue" || reportType === "ageing-summary"
							}
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
