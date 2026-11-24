import { useStore } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { FileIcon } from "lucide-react";
import { useMemo } from "react";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { FieldGroup } from "@/components/ui/field";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { MultiSelectItem } from "@/components/ui/multi-select";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { EnquiryConversionReport } from "@/features/enquiries/components/conversion-report";
import { ENQUIRY_SOURCE_OPTIONS } from "@/features/enquiries/lib/constants";
import { UNASSIGNED_FILTER } from "@/features/enquiries/lib/enquiry-report";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import {
	type EnquiryConversionFormSchema,
	enquiryConversionFormSchema,
	enquiryConversionValidateSearch,
} from "@/features/enquiries/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { assertCan } from "@/lib/permissions/can";

export const Route = createFileRoute("/app/reports/enquiries/conversion/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "enquiries:report");
	},
	component: RouteComponent,
	validateSearch: enquiryConversionValidateSearch,
	head: () => ({
		meta: [{ title: "Enquiry Conversion / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Enquiry conversion",
	},
	loader: async ({ context: { queryClient } }) => ({
		staff: await queryClient.ensureQueryData(enquiryQueries.reportStaffOptions()),
	}),
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);

	return (
		<Wrapper size="full">
			<PageHeader
				title="Enquiry Conversion"
				description="How many enquiries become members, how fast, and where they come from."
			/>
			<ReportFilters />
			{filters.dateRange?.from && filters.dateRange?.to && (
				<ErrorBoundaryWithSuspense loader={<DatatableSkeleton />}>
					<EnquiryConversionReport />
				</ErrorBoundaryWithSuspense>
			)}
		</Wrapper>
	);
}

function ReportFilters() {
	const { filters, setFilters } = useFilters(Route.id);
	const { staff } = Route.useLoaderData();
	const staffItems = useMemo(
		() => [{ value: UNASSIGNED_FILTER, label: "Unassigned" }, ...staff],
		[staff]
	);

	const form = useAppForm({
		defaultValues: {
			dateRange: {
				from: filters.dateRange?.from,
				to: filters.dateRange?.to,
			},
			source: filters.source ?? [],
			assignedEmployeeId: filters.assignedEmployeeId,
		} as EnquiryConversionFormSchema,
		validators: {
			onSubmit: enquiryConversionFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters(value);
		},
	});

	const [source] = useStore(form.store, (state) => [state.values.source]);

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
				<form.AppField name="source">
					{(field) => (
						<field.MultiSelect
							label="Source"
							placeholder={source?.length ? "Sources selected" : "All sources"}
						>
							{ENQUIRY_SOURCE_OPTIONS.map((option) => (
								<MultiSelectItem key={option.value} value={option.value}>
									{option.label}
								</MultiSelectItem>
							))}
						</field.MultiSelect>
					)}
				</form.AppField>
				<form.AppField name="assignedEmployeeId">
					{(field) => (
						<field.Combobox label="Assigned staff" placeholder="All staff" items={staffItems} />
					)}
				</form.AppField>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton buttonText="Preview" icon={<FileIcon />} withReset={false} />
			</form.AppForm>
		</form>
	);
}
