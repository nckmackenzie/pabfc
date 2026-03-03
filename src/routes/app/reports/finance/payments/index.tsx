import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import type { z } from "zod";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { supplierQueries } from "@/features/bills/services/queries";
import { PaymentsReportDataTable } from "@/features/reports/components/payments-report-datatable";
import {
	paymentsReportFormSchema,
	paymentsValidateSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/finance/payments/")({
	beforeLoad: async () => {
		await requirePermission("reports:payments-report");
	},
	component: RouteComponent,
	validateSearch: paymentsValidateSchema,
	head: () => ({
		meta: [{ title: "Payments Report / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Payments report",
	},
	loader: async ({ context: { queryClient } }) => {
		const vendors = await queryClient.ensureQueryData(supplierQueries.list({}));
		return {
			vendors: vendors.map(({ id, name }) => ({
				value: id,
				label: toTitleCase(name),
			})),
		};
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const hasRequiredFilters = Boolean(
		filters.dateRange?.from && filters.dateRange?.to && filters.vendorId,
	);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Payments Report"
				description="View detailed vendor payment transactions for the selected period."
			/>
			<ReportFilters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<PaymentsReportDataTable />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { vendors } = Route.useLoaderData();
	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
			vendorId: filters.vendorId ?? "all",
		} as z.infer<typeof paymentsReportFormSchema>,
		validators: {
			onSubmit: paymentsReportFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

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
				<form.AppField name="vendorId">
					{(field) => (
						<field.Combobox
							items={[{ value: "all", label: "All Vendors" }, ...vendors]}
							placeholder="Select vendor"
							label="Vendor"
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
