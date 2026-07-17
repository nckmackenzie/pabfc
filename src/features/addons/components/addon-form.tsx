import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { type AddonSchema, addonSchema } from "@/features/addons/services/schemas";
import { upsertAddon } from "@/features/addons/services/addons.api";
import { accountQueries } from "@/features/coa/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";

const defaultValues = {
	name: "",
	description: "",
	amount: 0,
	perMember: false,
	active: true,
	revenueAccountId: "",
} as AddonSchema;

export function AddonForm({
	addon,
	hasInvoiceLines = false,
}: {
	addon?: AddonSchema;
	hasInvoiceLines?: boolean;
}) {
	const contextAccounts = useRouteContext({
		from: "/app/plans",
		select: (ctx) => ctx.accounts,
	});
	const { data: freshAccounts } = useQuery(accountQueries.list({}));
	const accounts = freshAccounts || contextAccounts;
	const originalAmount = addon?.amount;

	const form = useAppForm({
		defaultValues: addon || defaultValues,
		validators: {
			onSubmit: addonSchema,
		},
		onSubmit: ({ value }) => {
			addonMutation.mutate(
				{ ...value, id: addon?.id },
				{
					onSuccess: () => {
						form.reset();
					},
				}
			);
		},
	});

	const addonMutation = useFormUpsert({
		upsertFn: (values: AddonSchema) => upsertAddon({ data: values }),
		entityName: "Addon",
		queryKey: ["addons"],
		navigateTo: "/app/plans/addons",
		onReset: () => form.reset(),
	});

	const currentAmount = useStore(form.store, (state) => state.values.amount);
	// Amount is snapshotted onto each invoice line, so changing it is allowed even
	// when the addon has been billed — but we warn so it's a deliberate choice.
	const showAmountWarning =
		hasInvoiceLines &&
		originalAmount !== undefined &&
		Number(currentAmount) !== Number(originalAmount);

	return (
		<div className="space-y-6">
			<PageHeader
				title={addon ? "Edit Addon" : "Create Addon"}
				description={addon ? "Update the details of the addon" : "Provide the details of the addon"}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="name">
						{(field) => <field.Input label="Addon Name" placeholder="Enter addon name" required />}
					</form.AppField>
					<form.AppField name="amount">
						{(field) => (
							<field.Input
								type="number"
								label="Rate per period"
								placeholder="Enter the rate charged per period"
								min={0}
								step="0.01"
								required
							/>
						)}
					</form.AppField>
					{showAmountWarning && (
						<div className="col-span-2">
							<CustomAlert
								variant="warning"
								title="This addon has already been billed"
								description="Existing receipts keep the rate they were charged at. The new rate only applies to future receipts."
							/>
						</div>
					)}
					<form.AppField name="description">
						{(field) => <field.Textarea label="Description" placeholder="Enter description" />}
					</form.AppField>
					<form.AppField name="revenueAccountId">
						{(field) => (
							<field.Select label="Revenue Account" required>
								{accounts
									.filter(
										(account) => account.isActive && account.isPosting && account.type === "revenue"
									)
									.map((account) => (
										<SelectItem key={account.id.toString()} value={account.id.toString()}>
											{account.name}
										</SelectItem>
									))}
							</field.Select>
						)}
					</form.AppField>
					<div className="col-span-2">
						<div className="flex items-center gap-2">
							<form.AppField name="perMember">
								{(field) => (
									<field.Checkbox
										label="Charge per member"
										helperText="If enabled, total is multiplied by the number of members covered by the plan"
									/>
								)}
							</form.AppField>
						</div>
					</div>
					{addon && (
						<FieldGroup className="col-span-2">
							<form.AppField name="active">
								{(field) => <field.Checkbox label="Active" />}
							</form.AppField>
						</FieldGroup>
					)}
					<form.AppForm>
						<form.SubmitButton
							isLoading={addonMutation.isPending}
							buttonText={addon ? "Update Addon" : "Create Addon"}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
