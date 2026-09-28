import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { useRequestComplimentaryMembership } from "@/features/receipts/hooks/use-request-complimentary-membership";
import { complimentaryQueries } from "@/features/receipts/services/complimentary.queries";
import {
	complimentaryRequestSchema,
	type ComplimentaryRequestSchema,
} from "@/features/receipts/services/complimentary.schemas";
import { usePreventUnsavedChanges } from "@/hooks/use-prevent-navigation";
import { useAppForm } from "@/lib/form";

const defaultValues: ComplimentaryRequestSchema = {
	memberId: "",
	planId: "",
	startDate: "",
	numberOfPeriods: 1,
	reason: "",
};

export function ComplimentaryRequestForm() {
	const { members, plans } = getRouteApi("/app/receipts/complimentary/new").useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const requestMutation = useRequestComplimentaryMembership();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues,
		validators: { onSubmit: complimentaryRequestSchema },
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			requestMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					queryClient.invalidateQueries({ queryKey: complimentaryQueries.all });
					form.reset();
					// Deferred so the reset's isDirty:false state commits before we
					// navigate — otherwise usePreventUnsavedChanges's blocker still
					// sees the stale dirty form and pops the "unsaved changes"
					// confirm dialog right after a successful save. Same pattern
					// as useFormUpsert's post-success navigate.
					setTimeout(() => {
						navigate({ to: "/app/receipts/complimentary" });
					}, 0);
				},
			});
		},
	});

	const isDirty = useStore(form.store, (state) => state.isDirty);
	usePreventUnsavedChanges(isDirty);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Request Complimentary Membership"
				description="Request a free membership on an existing plan for a member. Requires approval before it takes effect. Only single-member plans are eligible."
			/>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="memberId">
						{(field) => (
							<field.Combobox
								label="Member"
								required
								placeholder="Select a member"
								items={members}
							/>
						)}
					</form.AppField>
					<form.AppField name="planId">
						{(field) => (
							<field.Combobox
								label="Plan"
								required
								placeholder="Select a single-member plan"
								helperText="Only active, single-member plans are eligible for complimentary membership."
								items={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="startDate">
						{(field) => <field.Input label="Start Date" type="date" required />}
					</form.AppField>
					<form.AppField name="numberOfPeriods">
						{(field) => (
							<field.Input label="Number of Periods" type="number" min={1} step={1} required />
						)}
					</form.AppField>
					<form.AppField name="reason">
						{(field) => (
							<field.Textarea
								label="Reason"
								fieldClassName="col-span-2"
								placeholder="Explain why this membership is being granted for free (min. 10 characters)"
								required
							/>
						)}
					</form.AppField>
					{submissionError && (
						<div className="col-span-2">
							<CustomAlert variant="destructive" title="Error" description={submissionError} />
						</div>
					)}
					<form.AppForm>
						<form.SubmitButton buttonText="Submit request" isLoading={requestMutation.isPending} />
					</form.AppForm>
				</FieldGroup>
			</form>
		</div>
	);
}
