import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import type { z } from "zod";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { IncomeStatementReport } from "@/features/reports/components/income-statement-report";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";
import { dateRangeRequiredSchema, dateRangeSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/reports/finance/income-statement/")({
	beforeLoad: async () => {
		await requirePermission("reports:income-statement");
	},
	component: RouteComponent,
	staticData: {
		breadcrumb: "Income Statement",
	},
	head: () => ({
		meta: [{ title: "Income Statement / Prime Age Beauty & Fitness Center" }],
	}),
	validateSearch: dateRangeSchema,
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const hasRequiredFilters = Boolean(
		filters.dateRange?.from && filters.dateRange?.to,
	);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Income Statement"
				description="Profit and Loss Statement"
			/>
			<ReportFilters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<IncomeStatementReport />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
		} as z.infer<typeof dateRangeRequiredSchema>,
		validators: {
			onSubmit: dateRangeRequiredSchema,
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
			<FieldGroup className="max-w-sm">
				<form.AppField name="dateRange">
					{(field) => <field.DateRangePicker asString label="Date Range" />}
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
