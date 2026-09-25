import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BasePageComponent } from "@/components/ui/base-page";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/ui/permission-gate";
import { SelectItem } from "@/components/ui/select";
import {
	type LedgerAccountMappingListItem,
	type LedgerAccountMappingOption,
	updateLedgerAccountMappingFn,
} from "@/features/coa/services/account-mappings.api";
import {
	type LedgerAccountMappingFormValues,
	ledgerAccountMappingFormSchema,
} from "@/features/coa/services/account-mappings.schemas";
import { accountMappingQueries } from "@/features/coa/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

function accountLabel(account: {
	code: string | null;
	name: string;
}) {
	return `${account.code ?? "No Code"} - ${toTitleCase(account.name)}`;
}

function MappingStatusBadge({
	mapping,
}: {
	mapping: LedgerAccountMappingListItem;
}) {
	if (!mapping.accountId || !mapping.account) {
		return <Badge variant="warning">Missing</Badge>;
	}

	if (!mapping.account.isActive) {
		return <Badge variant="destructive">Inactive Account</Badge>;
	}

	if (mapping.account.type !== mapping.requiredAccountType) {
		return <Badge variant="destructive">Wrong Account Type</Badge>;
	}

	if (!mapping.account.isPosting) {
		return <Badge variant="destructive">Not A Posting Account</Badge>;
	}

	return <Badge variant="success">Configured</Badge>;
}

function AccountMappingCard({
	accountOptions,
	mapping,
}: {
	accountOptions: Array<LedgerAccountMappingOption>;
	mapping: LedgerAccountMappingListItem;
}) {
	const [warnings, setWarnings] = useState<Array<string>>([]);

	const mutation = useFormUpsert({
		upsertFn: (data: LedgerAccountMappingFormValues) =>
			updateLedgerAccountMappingFn({
				data: {
					role: data.role,
					accountId: Number(data.accountId),
					description: data.description || null,
				},
			}),
		entityName: "Account mapping",
		queryKey: ["accounts", "mappings"],
		successMessage: {
			create: "Account mapping saved successfully.",
			update: "Account mapping saved successfully.",
		},
		onSuccessCallback: (result) => {
			setWarnings(result.warnings);
		},
	});

	const form = useAppForm({
		defaultValues: {
			role: mapping.role,
			accountId: mapping.accountId ? String(mapping.accountId) : "",
			description: mapping.description ?? "",
		} as LedgerAccountMappingFormValues,
		validators: {
			onSubmit: ledgerAccountMappingFormSchema,
		},
		onSubmit: ({ value }) => mutation.mutate(value),
	});

	// Only accounts of the type this role requires — a liability role cannot be
	// bound to an asset account, and the server rejects it anyway.
	const filteredOptions = accountOptions.filter(
		(account) => account.type === mapping.requiredAccountType,
	);

	return (
		<div className="rounded-md border bg-card p-5 space-y-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h2 className="text-base font-semibold">{mapping.label}</h2>
						<MappingStatusBadge mapping={mapping} />
					</div>
					<p className="text-sm text-muted-foreground">
						{mapping.roleDescription}
					</p>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Expected account type: {toTitleCase(mapping.requiredAccountType)}
					</p>
				</div>
				<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
					<p className="font-medium">Current Mapping</p>
					<p className="text-muted-foreground">
						{mapping.account
							? accountLabel(mapping.account)
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
										{accountLabel(account)}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<div className="rounded-md border bg-muted/30 p-3 text-sm">
						<p className="font-medium">Account Rules</p>
						<p className="mt-1 text-muted-foreground">
							Only active posting {mapping.requiredAccountType} accounts are
							offered here. Renaming the account later is safe — postings resolve
							it by this mapping, not by its name.
						</p>
					</div>
				</div>

				<form.AppField name="description">
					{(field) => (
						<field.Textarea
							label="Description"
							rows={3}
							placeholder="Explain how this mapping is used when posting"
						/>
					)}
				</form.AppField>

				{warnings.length ? (
					<div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
						{warnings.join(" ")}
					</div>
				) : null}

				<PermissionGate permission="ledger-account-mappings:update">
					<form.AppForm>
						<form.SubmitButton
							buttonText="Save Mapping"
							isLoading={mutation.isPending}
							withReset={false}
						/>
					</form.AppForm>
				</PermissionGate>
			</form>
		</div>
	);
}

export function LedgerAccountMappingsPage() {
	const { data: mappings } = useSuspenseQuery(accountMappingQueries.list());
	const { data: accountOptions } = useSuspenseQuery(
		accountMappingQueries.accountOptions(),
	);

	const isComplete = mappings.isComplete && !mappings.hasInvalidMappings;

	return (
		<BasePageComponent
			pageTitle="Account Mappings"
			pageDescription="Bind each posting role to the ledger account the journal engine should use."
		>
			<div className="space-y-6">
				<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
					<div className="rounded-md border bg-card p-5">
						<p className="text-sm font-medium text-muted-foreground">
							Configuration Status
						</p>
						<p className="mt-2 text-2xl font-semibold">
							{isComplete ? "Complete" : "Incomplete"}
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{isComplete
								? "Every role is mapped to an active ledger account of the correct type."
								: "Bills, payments, expenses and remittances that need an unmapped role will refuse to post until it is set."}
						</p>
					</div>
					<div className="rounded-md border bg-card p-5">
						<p className="text-sm font-medium text-muted-foreground">
							Unmapped Roles
						</p>
						<p className="mt-2 text-2xl font-semibold">
							{mappings.missingRoles.length}
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{mappings.missingRoles.length
								? mappings.missingRoles
										.map((role) => toTitleCase(role.replace(/_/g, " ")))
										.join(", ")
								: "All roles are mapped."}
						</p>
					</div>
				</div>

				<div className="space-y-4">
					{mappings.items.map((mapping) => (
						<AccountMappingCard
							key={mapping.role}
							accountOptions={accountOptions}
							mapping={mapping}
						/>
					))}
				</div>
			</div>
		</BasePageComponent>
	);
}
