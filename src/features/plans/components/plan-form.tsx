import { useStore } from "@tanstack/react-form";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { type PlanSchema, planSchema } from "@/features/plans/services/schemas";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";
import type { WithId } from "@/types/index.types";
import { createPlan } from "../services/plans.api";

export function PlanForm({ plan }: { plan?: PlanSchema & WithId }) {
	const form = useAppForm({
		defaultValues: {
			name: "",
			duration: 0,
			price: 0,
			description: "",
			isSessionBased: false,
			sessionCount: null,
			active: true,
		} as PlanSchema,
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
		// updateFn: (values: PlanSchema) => updatePlan({ data: values }),
	});

	const [isDirty, isSessionBased] = useStore(form.store, (state) => [
		state.isDirty,
		state.values.isSessionBased,
	]);

	usePreventUnsavedChanges(isDirty);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Create Plan"
				description="Provide the details of the plan"
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
					<FieldGroup className="col-span-2 ">
						<div className="flex items-center gap-2">
							<form.AppField name="isSessionBased">
								{(field) => <field.Checkbox label="Is Session Based" />}
							</form.AppField>
						</div>
						<form.AppField name="sessionCount">
							{(field) => (
								<field.Input
									label="Session Count"
									placeholder="Enter session count"
									disabled={!isSessionBased}
									required={isSessionBased}
								/>
							)}
						</form.AppField>
					</FieldGroup>
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
							buttonText="Create Plan"
						/>
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
