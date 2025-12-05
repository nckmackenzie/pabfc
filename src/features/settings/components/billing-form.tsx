import { useStore } from "@tanstack/react-form";
import { FieldGroup } from "@/components/ui/field";
import { SelectItem } from "@/components/ui/select";
import { useSettingsMutation } from "@/features/settings/hooks/useSettingsMutation";
import {
	type BillingSchema,
	billingSchema,
} from "@/features/settings/services/schemas";
import { upsertBillingSettings } from "@/features/settings/services/settings.api";
import { useAppForm } from "@/lib/form";

export function BillingForm({
	billingSettings,
}: {
	billingSettings?: BillingSchema;
}) {
	const dataMutation = useSettingsMutation({
		actionFn: upsertBillingSettings,
		queryKey: ["settings"],
		errorMessage: "Error updating settings",
		displaySuccessToast: true,
	});
	const form = useAppForm({
		defaultValues:
			billingSettings ??
			({
				invoicePrefix: null,
				invoiceNumberPadding: null,
				applyTaxToMembership: false,
				vatType: null,
			} as BillingSchema),
		validators: {
			onSubmit: billingSchema,
		},
		onSubmit: ({ value }) => {
			dataMutation.mutate({ data: { data: value } });
		},
	});

	const [applyTaxToMembership, invoicePrefix] = useStore(
		form.store,
		(state) => [state.values.applyTaxToMembership, state.values.invoicePrefix],
	);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup className="grid lg:grid-cols-2 gap-4">
				<form.AppField name="invoicePrefix">
					{(field) => (
						<field.Input
							label="Invoice Prefix"
							placeholder="Enter invoice prefix"
							type="text"
							helperText="Prefix for invoice numbers. eg INV-"
						/>
					)}
				</form.AppField>
				<form.AppField name="invoiceNumberPadding">
					{(field) => (
						<field.Input
							label="Invoice Number Padding"
							placeholder="Enter invoice number padding"
							type="number"
							helperText={`Number of padding characters for invoice numbers. eg 6 will result in ${invoicePrefix ? invoicePrefix?.toUpperCase() : "INV"}-000001`}
						/>
					)}
				</form.AppField>
				<div className="self-center">
					<form.AppField name="applyTaxToMembership">
						{(field) => (
							<field.Checkbox
								label="Apply Tax to Membership"
								helperText="Apply tax to membership."
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="vatType">
					{(field) => (
						<field.Select
							disabled={!applyTaxToMembership}
							label="VAT Type"
							helperText="VAT type for invoices."
						>
							<SelectItem value="inclusive">Inclusive</SelectItem>
							<SelectItem value="exclusive">Exclusive</SelectItem>
						</field.Select>
					)}
				</form.AppField>

				<div className="col-span-full">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Billing Settings"
							withReset
							isLoading={dataMutation.isPending}
						/>
					</form.AppForm>
				</div>
			</FieldGroup>
		</form>
	);
}
