import { useRouteContext } from "@tanstack/react-router";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { upsertBankPosting } from "@/features/bankings/services/bankings.api";
import {
	type BankPostingSchema,
	bankPostingSchema,
} from "@/features/bankings/services/schema";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { dateFormat } from "@/lib/helpers";

const defaultValues = {
	transactionDate: dateFormat(new Date()),
	bankId: "",
	direction: "credit" as BankPostingSchema["direction"],
	amount: 0,
	reference: "",
	narration: "",
	counterAccountId: "",
};

export const BankPostingForm = ({
	posting,
}: {
	posting?: BankPostingSchema;
}) => {
	const { accounts } = useRouteContext({
		from: "/app/bankings/postings",
	});
	const { banks } = useRouteContext({
		from: "/app/bankings",
	});

	const { isPending, mutate: upsert } = useFormUpsert({
		upsertFn: (data: BankPostingSchema) => upsertBankPosting({ data }),
		entityName: "Bank Posting",
		queryKey: ["bankings"],
		navigateTo: "/app/bankings/postings",
	});

	const form = useAppForm({
		defaultValues: posting ?? defaultValues,
		validators: {
			onSubmit: bankPostingSchema,
		},
		onSubmit: ({ value }) => {
			upsert({ ...value, id: posting?.id });
		},
	});
	return (
		<div className="space-y-6">
			<PageHeader
				title={posting ? "Edit Bank Posting" : "New Bank Posting"}
				description={
					posting ? "Edit a bank posting" : "Create a new bank posting"
				}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="transactionDate">
						{(field) => (
							<field.Input type="date" label="Transaction Date" required />
						)}
					</form.AppField>
					<form.AppField name="bankId">
						{(field) => (
							<field.Select label="Bank" required>
								{banks.map((bank) => (
									<SelectItem key={bank.id} value={bank.id}>
										{bank.bankName}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="amount">
						{(field) => <field.Input type="number" label="Amount" required />}
					</form.AppField>
					<form.AppField name="direction">
						{(field) => (
							<field.Select label="Direction" required>
								{[
									{ value: "credit", label: "Money Out" },
									{ value: "debit", label: "Money In" },
								].map((direction) => (
									<SelectItem key={direction.value} value={direction.value}>
										{direction.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="counterAccountId">
						{(field) => (
							<field.Select label="Counter Account" required>
								{accounts.map((account) => (
									<SelectItem key={account.value} value={account.value}>
										{account.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="reference">
						{(field) => (
							<field.Input
								label="Reference"
								placeholder="eg chq458555"
								required
							/>
						)}
					</form.AppField>
					<form.AppField name="narration">
						{(field) => (
							<field.Input
								label="Narration"
								placeholder="eg Payment for services"
								required
								fieldClassName="col-span-2"
							/>
						)}
					</form.AppField>
				</FieldGroup>
				<FieldGroup>
					<form.AppForm>
						<form.SubmitButton
							isLoading={isPending}
							buttonText={
								posting ? "Update Bank Posting" : "Create Bank Posting"
							}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
};
