import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useEffect } from "react";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { SelectItem } from "@/components/ui/select";
import { accountQueries } from "@/features/coa/services/queries";
import { type PlanSchema, planSchema } from "@/features/plans/services/schemas";
import { lateUpgradeGraceDaysDefaultQuery } from "@/features/settings/services/queries";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useAppForm } from "@/lib/form";
import { upsertPlan } from "../services/plans.api";

const defaultValues = {
	name: "",
	// duration: 0,
	// price: 0,
	memberCount: 1,
	description: "",
	isSessionBased: false,
	sessionCount: null,
	active: true,
	isGuestPass: false,
	validFrom: null,
	validTo: null,
	revenueAccountId: "",
	lateUpgradeGraceDays: null,
} as PlanSchema;

export function PlanForm({ plan }: { plan?: PlanSchema }) {
	const contextAccounts = useRouteContext({
		from: "/app/plans",
		select: (ctx) => ctx.accounts,
	});
	// Fetched lazily via useQuery, not route context — the parent /app/plans
	// beforeLoad must stay free of plans:create/plans:update requirements (other
	// routes under it, like the plans list, only need plans:view), while this
	// form is only ever rendered on /app/plans/new or /app/plans/$planId/edit,
	// both of which already guarantee one of those two permissions individually.
	const { data: lateUpgradeGraceDaysDefault } = useQuery(lateUpgradeGraceDaysDefaultQuery());
	const { data: freshAccounts } = useQuery(accountQueries.list({}));
	const accounts = freshAccounts || contextAccounts;
	const form = useAppForm({
		defaultValues: plan || defaultValues,
		validators: {
			onSubmit: planSchema,
		},
		onSubmit: ({ value }) => {
			planMutation.mutate(
				{ ...value, id: plan?.id },
				{
					onSuccess: () => {
						form.reset();
					},
				}
			);
		},
	});

	const planMutation = useFormUpsert({
		upsertFn: (values: PlanSchema) => upsertPlan({ data: values }),
		entityName: "Plan",
		queryKey: ["plans"],
		navigateTo: "/app/plans",
		onReset: () => form.reset(),
	});

	const [isSessionBased, price, isGuestPass] = useStore(form.store, (state) => [
		state.values.isSessionBased,
		state.values.price,
		state.values.isGuestPass,
	]);
	const isPaidPlan = Number(price) > 0;

	useEffect(() => {
		if (isSessionBased) {
			form.setFieldValue("memberCount", 1);
		}
	}, [isSessionBased, form]);

	// A guest pass is always a single session for a single person.
	useEffect(() => {
		if (isGuestPass) {
			form.setFieldValue("isSessionBased", true);
			form.setFieldValue("sessionCount", 1);
			form.setFieldValue("memberCount", 1);
		}
	}, [isGuestPass, form]);

	return (
		<div className="space-y-6">
			<PageHeader
				title={plan ? "Edit Plan" : "Create Plan"}
				description={plan ? "Update the details of the plan" : "Provide the details of the plan"}
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="name">
						{(field) => <field.Input label="Plan Name" placeholder="Enter plan name" required />}
					</form.AppField>
					<form.AppField name="duration">
						{(field) => (
							<field.Input
								label={isSessionBased ? "Validity (in days)" : "Duration (in days)"}
								type="number"
								placeholder={
									isSessionBased
										? "Enter validity period in days"
										: "Enter duration in days"
								}
								helperText={
									isSessionBased
										? "Unused sessions lapse once the validity window ends."
										: undefined
								}
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
								helperText="Use 0 for a complimentary-only plan."
								min={0}
								required
							/>
						)}
					</form.AppField>
					<form.AppField name="memberCount">
						{(field) => (
							<field.Input
								type="number"
								label="Member Count"
								placeholder="Enter number of members covered"
								helperText={
									isSessionBased
										? "Session-based plans cover one member"
										: "Number of members this plan covers, e.g. 2 for a couple plan"
								}
								min={1}
								step={1}
								required
								disabled={isSessionBased || isGuestPass}
							/>
						)}
					</form.AppField>
					<form.AppField name="description">
						{(field) => <field.Textarea label="Description" placeholder="Enter description" />}
					</form.AppField>
					<div className="col-span-2 space-y-4">
						<form.AppField name="isGuestPass">
							{(field) => (
								<field.Switch
									label="Guest pass (sponsored promo)"
									helperText="A sponsor pays for a new person's single visit within the availability window."
								/>
							)}
						</form.AppField>
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
								disabled={!isSessionBased || isGuestPass}
								required={isSessionBased}
							/>
						)}
					</form.AppField>
					<form.AppField name="validFrom">
						{(field) => (
							<field.Input
								type="date"
								label="Available from"
								required={isGuestPass}
								helperText={
									isGuestPass
										? "Passes can be sold and used only within these dates."
										: "Limits the dates this plan can be sold. Does not change membership end dates."
								}
							/>
						)}
					</form.AppField>
					<form.AppField name="validTo">
						{(field) => (
							<field.Input
								type="date"
								label="Available to"
								required={isGuestPass}
								helperText={
									isGuestPass
										? "Passes can be sold and used only within these dates."
										: "Limits the dates this plan can be sold. Does not change membership end dates."
								}
							/>
						)}
					</form.AppField>
					<form.AppField name="revenueAccountId">
						{(field) => (
							<field.Select
								label="Revenue Account"
								placeholder={isPaidPlan ? "Select an account" : "Select an account (optional)"}
								helperText="Leave blank for a complimentary-only plan that never posts revenue. Required when price is above zero."
								required={isPaidPlan}
							>
								{accounts
									.filter(
										(account) => account.type === "revenue" && account.isActive && account.isPosting
									)
									.map((account) => (
										<SelectItem key={account.id.toString()} value={account.id.toString()}>
											{account.name}
										</SelectItem>
									))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="lateUpgradeGraceDays">
						{(field) => (
							<field.Input
								type="number"
								label="Late Upgrade Grace Period (days)"
								placeholder={`Default: ${lateUpgradeGraceDaysDefault ?? 3}`}
								helperText={`Leave blank to use the default of ${lateUpgradeGraceDaysDefault ?? 3} days.`}
								min={0}
								step={1}
							/>
						)}
					</form.AppField>
					{plan && (
						<FieldGroup className="col-span-2">
							<form.AppField name="active">
								{(field) => <field.Checkbox label="Active" />}
							</form.AppField>
						</FieldGroup>
					)}
					<FieldGroup className="col-span-2">
						<form.AppForm>
							<form.SubmitButton
								isLoading={planMutation.isPending}
								buttonText={plan ? "Update Plan" : "Create Plan"}
							/>
						</form.AppForm>
					</FieldGroup>
				</FieldGroup>
			</form>
		</div>
	);
}
