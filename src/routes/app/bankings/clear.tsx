import { useStore } from "@tanstack/react-form";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { SelectItem } from "@/components/ui/select";
import { ClearBankingsForm } from "@/features/bankings/components/clear-bankings-form";
import {
	clearBankingsFilterFormSchema,
	clearBankingsValidateSearch,
} from "@/features/bankings/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { useAppForm } from "@/lib/form";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { cn, toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/bankings/clear")({
	component: RouteComponent,
	beforeLoad: async () => {
		await requirePermission("banking:clear");
	},
	validateSearch: clearBankingsValidateSearch,
	staticData: {
		breadcrumb: "Clear bankings",
	},
	head: () => ({
		meta: [{ title: "Clear Bankings / Prime Age Beauty & Fitness Centre" }],
	}),
});

function RouteComponent() {
	const { filters } = useFilters(Route.id);
	const filtersProvided = !!(filters.bankId && filters.from && filters.to);
	return (
		<ProtectedPageWithWrapper permissions={["banking:clear"]}>
			<PageHeader
				title="Bank Clearings"
				description="Clear bank postings. Select a bank and a date range to view and clear bank postings."
			/>
			<Filters />
			{filtersProvided && <ClearBankingsForm />}
		</ProtectedPageWithWrapper>
	);
}

function Filters() {
	const { filters, setFilters, resetFilters } = useFilters(Route.id);
	const banks = useRouteContext({
		from: "/app/bankings",
		select: (s) => s.banks,
	});
	const form = useAppForm({
		defaultValues: {
			bankId: filters.bankId || "",
			from: filters.from || "",
			to: filters.to || "",
		},
		validators: {
			onSubmit: clearBankingsFilterFormSchema,
		},
		onSubmit: ({ value }) => {
			setFilters({
				bankId: value.bankId,
				from: dateFormat(value.from),
				to: dateFormat(value.to),
			});
		},
	});

	const errors = useStore(form.store, (state) => state.errors);

	function handleReset() {
		resetFilters();
		form.reset();
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="grid md:grid-cols-2 lg:grid-cols-4 gap-4"
		>
			<form.AppField name="bankId">
				{(field) => (
					<field.Select label="Bank" required>
						{banks.map((bank) => (
							<SelectItem key={bank.id} value={bank.id}>
								{toTitleCase(bank.bankName)}
							</SelectItem>
						))}
					</field.Select>
				)}
			</form.AppField>
			<form.AppField name="from">
				{(field) => <field.Input type="date" label="From" required />}
			</form.AppField>
			<form.AppField name="to">
				{(field) => <field.Input type="date" label="To" required />}
			</form.AppField>
			<form.AppForm>
				<form.SubmitButton
					fieldClassName={cn({
						"md:self-end": !errors.length,
						"md:self-center": errors.length > 0,
					})}
					buttonText="Filter"
					cancelButtonText="Clear"
					onReset={handleReset}
				/>
			</form.AppForm>
		</form>
	);
}
