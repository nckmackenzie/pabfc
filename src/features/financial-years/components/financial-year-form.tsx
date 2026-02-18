import { useStore } from "@tanstack/react-form";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { upsertFinancialYear } from "@/features/financial-years/services/financial-years.api";
import {
	type FinancialYearSchema,
	financialYearSchema,
} from "@/features/financial-years/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import type { WithId } from "@/types/index.types";

const defaultValues = {
	name: "",
	startDate: "",
	endDate: "",
	closed: false,
	closedDate: null,
} as FinancialYearSchema;

export function FinancialYearForm({
	financialYear,
}: {
	financialYear?: FinancialYearSchema & WithId;
}) {
	const form = useAppForm({
		defaultValues: financialYear || defaultValues,
		validators: {
			onSubmit: financialYearSchema,
		},
		onSubmit: ({ value }) => {
			financialYearMutation.mutate({ ...value, id: financialYear?.id });
		},
	});

	const financialYearMutation = useFormUpsert({
		upsertFn: (values: FinancialYearSchema) =>
			upsertFinancialYear({ data: values }),
		entityName: "Financial year",
		queryKey: ["financial-years"],
		navigateTo: "/app/financial-years",
		onReset: () => form.reset(),
	});

	const [isClosed] = useStore(form.store, (state) => [state.values.closed]);

	return (
		<div className="space-y-6">
			<PageHeader
				title={financialYear ? "Edit Financial Year" : "Create Financial Year"}
				description={
					financialYear
						? "Update financial year details"
						: "Provide details for the new financial year"
				}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="name">
						{(field) => (
							<field.Input label="Name" placeholder="2025/2026" required />
						)}
					</form.AppField>
					<form.AppField name="startDate">
						{(field) => <field.Input label="Start Date" type="date" required />}
					</form.AppField>
					<form.AppField name="endDate">
						{(field) => <field.Input label="End Date" type="date" required />}
					</form.AppField>
					<form.AppField name="closedDate">
						{(field) => (
							<field.Input
								label="Closed Date"
								type="date"
								disabled={!isClosed}
								required={isClosed}
							/>
						)}
					</form.AppField>
					<div className="md:col-span-2">
						<form.AppField name="closed">
							{(field) => <field.Checkbox label="Closed" />}
						</form.AppField>
					</div>
					<form.AppForm>
						<form.SubmitButton
							buttonText={
								financialYear
									? "Update Financial Year"
									: "Create Financial Year"
							}
							isLoading={financialYearMutation.isPending}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
