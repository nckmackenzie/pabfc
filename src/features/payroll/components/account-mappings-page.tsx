import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SelectItem } from "@/components/ui/select";
import { BasePageComponent } from "@/components/ui/base-page";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/ui/permission-gate";
import { PAYROLL_ACCOUNT_ROLES } from "@/features/payroll/lib/payroll-constants";
import {
	type PayrollAccountMappingListItem,
	type PayrollAccountMappingOption,
	updateAccountMappingFn,
} from "@/features/payroll/services/account-mappings.api";
import {
	type PayrollAccountMappingFormValues,
	payrollAccountMappingFormSchema,
} from "@/features/payroll/services/account-mappings.schemas";
import { payrollAccountMappingQueries } from "@/features/payroll/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

function MappingStatusBadge({ mapping }: { mapping: PayrollAccountMappingListItem }) {
	if (!mapping.accountId || !mapping.account) {
		return <Badge variant="warning">Missing</Badge>;
	}

	if (!mapping.account.isActive) {
		return <Badge variant="destructive">Inactive Account</Badge>;
	}

	return <Badge variant="success">Configured</Badge>;
}

function PayrollAccountMappingCard({
	accountOptions,
	mapping,
}: {
	accountOptions: PayrollAccountMappingOption[];
	mapping: PayrollAccountMappingListItem;
}) {
	const [warnings, setWarnings] = useState<string[]>([]);
	const defaultValues: PayrollAccountMappingFormValues = {
		id: mapping.role,
		role: mapping.role,
		accountId: mapping.accountId ? String(mapping.accountId) : "",
		description: mapping.description ?? "",
	};

	const mutation = useFormUpsert({
		upsertFn: (data: PayrollAccountMappingFormValues) =>
			updateAccountMappingFn({
				data: {
					role: data.role,
					accountId: Number(data.accountId),
					description: data.description || null,
				},
			}),
		entityName: "Payroll account mapping",
		queryKey: ["payroll-account-mappings"],
		successMessage: {
			update: "Payroll account mapping updated successfully.",
		},
		onSuccessCallback: (result) => {
			setWarnings(result.warnings);
		},
	});

	const form = useAppForm({
		defaultValues,
		validators: {
			onSubmit: payrollAccountMappingFormSchema,
		},
		onSubmit: ({ value }) => mutation.mutate(value),
	});

	const filteredOptions = accountOptions.filter(
		(account) => account.type === mapping.requiredAccountType
	);

	return (
		<div className="rounded-md border bg-card p-5 space-y-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h2 className="text-base font-semibold">{mapping.label}</h2>
						<MappingStatusBadge mapping={mapping} />
					</div>
					<p className="text-sm text-muted-foreground">{mapping.roleDescription}</p>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Expected account type: {toTitleCase(mapping.requiredAccountType)}
					</p>
				</div>
				<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
					<p className="font-medium">Current Mapping</p>
					<p className="text-muted-foreground">
						{mapping.account
							? `${mapping.account.code ?? "No Code"} - ${toTitleCase(mapping.account.name)}`
							: "No ledger account assigned"}
					</p>
				</div>
			</div>

			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
					<form.AppField name="accountId">
						{(field) => (
							<field.Select label="Ledger Account" required>
								{filteredOptions.map((account) => (
									<SelectItem key={account.id} value={String(account.id)}>
										{`${account.code ?? "No Code"} - ${toTitleCase(account.name)}`}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<div className="rounded-md border bg-muted/30 p-3 text-sm">
						<p className="font-medium">Account Rules</p>
						<p className="mt-1 text-muted-foreground">
							Only active posting {mapping.requiredAccountType} accounts are offered here.
						</p>
					</div>
				</div>

				<form.AppField name="description">
					{(field) => (
						<field.Textarea
							label="Description"
							rows={3}
							placeholder="Explain how this mapping is used during payroll posting"
						/>
					)}
				</form.AppField>

				{warnings.length ? (
					<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
						{warnings.join(" ")}
					</div>
				) : null}

				<PermissionGate permission="payroll-account-mappings:update">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Mapping"
							isLoading={mutation.isPending}
						/>
					</form.AppForm>
				</PermissionGate>
			</form>
		</div>
	);
}

export function PayrollAccountMappingsPage() {
	const { data: mappings } = useSuspenseQuery(payrollAccountMappingQueries.list());
	const { data: accountOptions } = useSuspenseQuery(
		payrollAccountMappingQueries.accountOptions()
	);
	const isConfigurationComplete = mappings.isConfigurationComplete;

	const assetMappings = mappings.items.filter(
		(mapping) => mapping.requiredAccountType === "asset"
	);
	const expenseMappings = mappings.items.filter(
		(mapping) => mapping.requiredAccountType === "expense"
	);
	const liabilityMappings = mappings.items.filter(
		(mapping) => mapping.requiredAccountType === "liability"
	);

	return (
		<BasePageComponent
			pageTitle="Payroll Account Mappings"
			pageDescription="Bind each payroll posting role to the ledger account your journal engine should use."
		>
			<div className="space-y-6">
				<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
					<div className="rounded-md border bg-card p-5">
						<p className="text-sm font-medium text-muted-foreground">Configuration Status</p>
						<p className="mt-2 text-2xl font-semibold">
							{isConfigurationComplete ? "Complete" : "Incomplete"}
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{isConfigurationComplete
								? "All payroll roles are mapped to active ledger accounts."
								: "Payroll posting should be blocked until every role is mapped to an active ledger account of the correct type."}
						</p>
					</div>
					<div className="rounded-md border bg-card p-5">
						<p className="text-sm font-medium text-muted-foreground">Missing Roles</p>
						<p className="mt-2 text-2xl font-semibold">{mappings.missingRoles.length}</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{mappings.missingRoles.length
								? mappings.missingRoles
										.map((role) => PAYROLL_ACCOUNT_ROLES[role].label)
										.join(", ")
								: "No missing mappings."}
						</p>
					</div>
				</div>

				<section className="space-y-4">
					<div>
						<h2 className="text-lg font-semibold">Asset Roles</h2>
						<p className="text-sm text-muted-foreground">
							These roles track payroll-related receivables or recoverable balances.
						</p>
					</div>
					<div className="space-y-4">
						{assetMappings.map((mapping) => (
							<PayrollAccountMappingCard
								key={mapping.role}
								accountOptions={accountOptions}
								mapping={mapping}
							/>
						))}
					</div>
				</section>

				<section className="space-y-4">
					<div>
						<h2 className="text-lg font-semibold">Expense Roles</h2>
						<p className="text-sm text-muted-foreground">
							These roles are debited when payroll costs are posted.
						</p>
					</div>
					<div className="space-y-4">
						{expenseMappings.map((mapping) => (
							<PayrollAccountMappingCard
								key={mapping.role}
								accountOptions={accountOptions}
								mapping={mapping}
							/>
						))}
					</div>
				</section>

				<section className="space-y-4">
					<div>
						<h2 className="text-lg font-semibold">Liability Roles</h2>
						<p className="text-sm text-muted-foreground">
							These roles are credited when payroll liabilities are posted.
						</p>
					</div>
					<div className="space-y-4">
						{liabilityMappings.map((mapping) => (
							<PayrollAccountMappingCard
								key={mapping.role}
								accountOptions={accountOptions}
								mapping={mapping}
							/>
						))}
					</div>
				</section>
			</div>
		</BasePageComponent>
	);
}
