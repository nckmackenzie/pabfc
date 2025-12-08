import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { accountQueries } from "@/features/coa/services/queries";
import { type PlanSchema, planSchema } from "@/features/plans/services/schemas";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useAppForm } from "@/lib/form";
import type { WithId } from "@/types/index.types";
import { createPlan, updatePlan } from "../services/plans.api";

const defaultValues = {
	name: "",
	duration: 0,
	price: 0,
	description: "",
	isSessionBased: false,
	sessionCount: null,
	active: true,
	revenueAccountId: "",
} as PlanSchema;

export function PlanForm({ plan }: { plan?: PlanSchema & WithId }) {
	const contextAccounts = useRouteContext({
		from: "/app/plans",
		select: (ctx) => ctx.accounts,
	});
	const { data: freshAccounts } = useQuery(accountQueries.list({}));
	const accounts = freshAccounts || contextAccounts;
	const form = useAppForm({
		defaultValues: plan || defaultValues,
		validators: {
			onSubmit: planSchema,
		},
		onSubmit: ({ value }) => {
			planMutation.mutate(
				{ data: value, id: plan?.id },
				{
					onSuccess: () => {
						form.reset();
					},
				},
			);
		},
	});

	const planMutation = useFormMutation({
		createFn: (values: PlanSchema) => createPlan({ data: values }),
		entityName: "Plan",
		queryKey: ["plans"],
		navigateTo: "/app/plans",
		onReset: () => form.reset(),
		updateFn: (planId: string, values: PlanSchema) =>
			updatePlan({ data: { values, planId } }),
	});

	const [isSessionBased] = useStore(form.store, (state) => [
		state.values.isSessionBased,
	]);

	return (
		<div className="space-y-6">
			<PageHeader
				title={plan ? "Edit Plan" : "Create Plan"}
				description={
					plan
						? "Update the details of the plan"
						: "Provide the details of the plan"
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
							<field.Input
								label="Plan Name"
								placeholder="Enter plan name"
								required
							/>
						)}
					</form.AppField>
					<form.AppField name="duration">
						{(field) => (
							<field.Input
								label="Duration"
								type="number"
								placeholder="Enter duration"
								required
							/>
						)}
					</form.AppField>
					<form.AppField name="price">
						{(field) => (
							<field.Input
								type="number"
								label="Price"
								placeholder="Enter price"
								required
							/>
						)}
					</form.AppField>
					<form.AppField name="description">
						{(field) => (
							<field.Textarea
								label="Description"
								placeholder="Enter description"
							/>
						)}
					</form.AppField>
					<div className="col-span-2 ">
						<div className="flex items-center gap-2">
							<form.AppField name="isSessionBased">
								{(field) => <field.Checkbox label="Is Session Based" />}
							</form.AppField>
						</div>
					</div>
					<form.AppField name="sessionCount">
						{(field) => (
							<field.Input
								type="number"
								label="Session Count"
								placeholder="Enter session count"
								disabled={!isSessionBased}
								required={isSessionBased}
							/>
						)}
					</form.AppField>
					<form.AppField name="revenueAccountId">
						{(field) => (
							<field.Select label="Revenue Account" required>
								{accounts
									.filter(
										(account) =>
											account.type === "revenue" &&
											account.isActive &&
											account.isPosting,
									)
									.map((account) => (
										<SelectItem
											key={account.id.toString()}
											value={account.id.toString()}
										>
											{account.name}
										</SelectItem>
									))}
							</field.Select>
						)}
					</form.AppField>
					{plan && (
						<FieldGroup className="col-span-2">
							<form.AppField name="active">
								{(field) => <field.Checkbox label="Active" />}
							</form.AppField>
						</FieldGroup>
					)}
					<form.AppForm>
						<form.SubmitButton
							isLoading={planMutation.isPending}
							buttonText={plan ? "Update Plan" : "Create Plan"}
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
