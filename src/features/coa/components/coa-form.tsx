import { useStore } from "@tanstack/react-form";
import { useRouteContext } from "@tanstack/react-router";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { ACCOUNT_TYPES } from "@/features/coa/lib/constants";
import { createAccount, updateAccount } from "@/features/coa/services/coa.api";
import {
	type AccountsFormSchema,
	accountsFormSchema,
} from "@/features/coa/services/schemas";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

const defaultValues = {
	name: "",
	type: "asset",
	isSubcategory: false,
	parentId: null,
	description: null,
	isActive: true,
} as AccountsFormSchema;

export function ChartOfAccountsForm({
	account,
}: {
	account?: AccountsFormSchema & { id: number };
}) {
	const parentAccounts = useRouteContext({
		from: "/app/chart-of-accounts",
		select: (context) => context.parentAccounts,
	});
	const accountMutation = useFormMutation({
		createFn: (values: AccountsFormSchema) => createAccount({ data: values }),
		updateFn: (accountId: string, values: AccountsFormSchema) =>
			updateAccount({ data: { values, id: Number(accountId) } }),
		entityName: "Account",
		queryKey: ["accounts"],
		onReset: () => form.reset(),
		navigateTo: "/app/chart-of-accounts",
	});

	const form = useAppForm({
		defaultValues: account || defaultValues,
		validators: {
			onSubmit: accountsFormSchema,
		},
		onSubmit: ({ value }) => {
			accountMutation.mutate({ data: value, id: account?.id.toString() });
		},
	});

	const [isSubcategory, type] = useStore(form.store, (state) => [
		state.values.isSubcategory,
		state.values.type,
	]);

	return (
		<div className="space-y-6">
			<PageHeader
				title={account ? "Edit Account" : "New Account"}
				description={
					account
						? `Editing ${toTitleCase(account.name)} details`
						: "Create a new account"
				}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.AppField name="name">
						{(field) => (
							<field.Input
								placeholder="Account Name"
								required
								label="Account Name"
							/>
						)}
					</form.AppField>
					<form.AppField name="type">
						{(field) => (
							<field.Select required label="Account Type">
								{ACCOUNT_TYPES.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="isSubcategory">
						{(field) => <field.Checkbox label="Sub Category Of" />}
					</form.AppField>
					<form.AppField name="parentId">
						{(field) => (
							<field.Select
								required={isSubcategory}
								label="Parent Account"
								disabled={!isSubcategory}
							>
								{parentAccounts
									.filter((acc) => acc.type === type)
									.map((account) => (
										<SelectItem
											key={account.value}
											value={account.value.toString()}
										>
											{account.label}
										</SelectItem>
									))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="description">
						{(field) => (
							<field.Input placeholder="Description" label="Description" />
						)}
					</form.AppField>
					<form.AppForm>
						<form.SubmitButton
							isLoading={accountMutation.isPending}
							buttonText={account ? "Update" : "Create"}
							withReset
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
