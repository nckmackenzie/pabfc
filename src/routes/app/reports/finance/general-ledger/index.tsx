import { createFileRoute } from "@tanstack/react-router";
import { FileIcon, LibraryIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { GeneralLedger, GeneralLedgerSkeleton } from "@/features/reports/components/general-ledger";
import { generalLedgerQueries } from "@/features/reports/services/queries";
import {
	type GeneralLedgerReportFormSchema,
	generalLedgerReportFormSchema,
	generalLedgerValidateSearchSchema,
} from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/reports/finance/general-ledger/")({
	beforeLoad: async () => {
		await requirePermission("reports:general-ledger");
	},
	component: RouteComponent,
	validateSearch: generalLedgerValidateSearchSchema,
	staticData: {
		breadcrumb: "General Ledger",
	},
	head: () => ({
		meta: [{ title: "General Ledger / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context: { queryClient } }) => {
		const accounts = await queryClient.ensureQueryData(generalLedgerQueries.accountOptions());
		return { accounts };
	},
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const { accountId } = filters;
	const { from, to } = filters.dateRange ?? {};

	return (
		<Wrapper size="full">
			<PageHeader
				title="General Ledger"
				description="Transaction history and running balance for a posting account."
			/>
			<ReportFilter />
			{accountId && from && to ? (
				<ErrorBoundaryWithSuspense
					key={`${accountId}-${from}-${to}`}
					loader={<GeneralLedgerSkeleton />}
				>
					<GeneralLedger accountId={accountId} dateFrom={from} dateTo={to} />
				</ErrorBoundaryWithSuspense>
			) : (
				<EmptyState
					icon={<LibraryIcon />}
					title="Select an account and period"
					description="Choose a posting account and date range, then preview the ledger."
				/>
			)}
		</Wrapper>
	);
}

function ReportFilter() {
	const { filters, setFilters } = useFilters(Route.id);
	const { accounts } = Route.useLoaderData();
	const form = useAppForm({
		defaultValues: {
			accountId: filters.accountId ?? "",
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
		} as GeneralLedgerReportFormSchema,
		validators: {
			onSubmit: generalLedgerReportFormSchema,
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
				<form.AppField name="accountId">
					{(field) => (
						<field.Combobox items={accounts} placeholder="Select account" label="Account" />
					)}
				</form.AppField>
				<form.AppField name="dateRange">
					{(field) => <field.DateRangePicker asString label="Date Range" />}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton buttonText="Preview" icon={<FileIcon />} withReset={false} />
			</form.AppForm>
		</form>
	);
}
