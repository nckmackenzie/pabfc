import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import type { z } from "zod";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { WhtScheduleReport } from "@/features/reports/components/wht-schedule-report";
import {
	whtScheduleFormSchema,
	whtScheduleValidateSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/finance/wht-schedule/")({
	beforeLoad: async () => {
		await requirePermission("reports:wht-schedule");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "WHT Schedule / Prime Age Beauty & Fitness Center" }],
	}),
	validateSearch: whtScheduleValidateSchema,
	staticData: {
		breadcrumb: "WHT schedule",
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const hasRequiredFilters = Boolean(
		filters.dateRange?.from && filters.dateRange?.to,
	);

	return (
		<Wrapper size="full">
			<PageHeader
				title="WHT Schedule"
				description="Withholding tax deducted per bill in a period, grouped by nature of expense, for filing the KRA return."
			/>
			<Filters />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense
					key={`${filters.dateRange?.from}-${filters.dateRange?.to}`}
					loader={<DatatableSkeleton />}
				>
					<WhtScheduleReport />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function Filters() {
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
		} as z.infer<typeof whtScheduleFormSchema>,
		validators: {
			onSubmit: whtScheduleFormSchema,
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
