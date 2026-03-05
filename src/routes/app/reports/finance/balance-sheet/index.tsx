import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import {
	BalanceSheet,
	BalanceSheetSkeleton,
} from "@/features/reports/components/balance-sheet";
import {
	trialBalanceReportFormSchema,
	trialBalanceValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/finance/balance-sheet/")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: "Balance Sheet / Prime Age Beauty & Fitness Center",
			},
		],
	}),
	beforeLoad: async () => {
		await requirePermission("reports:balance-sheet");
	},
	validateSearch: trialBalanceValidateSearchSchema,
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const hasRequiredFilters = Boolean(filters.asOfDate);
	return (
		<Wrapper size="full">
			<PageHeader
				title="Balance Sheet"
				description="Assets, liabilities, and equity snapshot."
			/>
			<ReportFilter />
			{hasRequiredFilters && (
				<ErrorBoundaryWithSuspense
					key={filters.asOfDate}
					loader={<BalanceSheetSkeleton />}
				>
					<BalanceSheet />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilter() {
	const { filters, setFilters } = useFilters(Route.id);
	const form = useAppForm({
		defaultValues: {
			asOfDate: filters.asOfDate,
		},
		validators: {
			onSubmit: trialBalanceReportFormSchema,
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
				<form.AppField name="asOfDate">
					{(field) => <field.Input type="date" label="As of Date" />}
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
