import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import toast from "react-hot-toast";
import { CustomAlert } from "@/components/ui/custom-alert";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import { useAddSessionUsage } from "@/features/session-usage/hooks/use-add-session-usage";
import { addSessionUsageSchema } from "@/features/session-usage/services/schemas";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";

export function AddSessionUsageModal({
	memberId,
	membershipId,
	minDate,
	maxDate,
}: {
	memberId: string;
	membershipId: string;
	minDate: string;
	maxDate: string;
}) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const addMutation = useAddSessionUsage();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: {
			membershipId,
			usageDate: format(new Date(), "yyyy-MM-dd"),
			reason: "",
		},
		validators: {
			onSubmit: addSessionUsageSchema,
		},
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			addMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					queryClient.invalidateQueries({ queryKey: ["members", "overview", memberId] });
					queryClient.invalidateQueries({ queryKey: ["members", "session-usage-history", memberId] });
					queryClient.invalidateQueries({ queryKey: ["members", "attendance-history", memberId] });
					toast.success((t) => (
						<ToastContent t={t} title="Session added" message="The session has been recorded." />
					));
					setClose();
				},
			});
		},
	});

	return (
		<CustomModal
			title="Add a session"
			subtitle="Record a manually-added session for this membership. This may extend the membership's remaining balance."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.AppField name="usageDate">
						{(field) => (
							<field.Input
								label="Session date"
								type="date"
								required
								min={minDate}
								max={maxDate}
							/>
						)}
					</form.AppField>

					<form.AppField name="reason">
						{(field) => (
							<field.Textarea
								label="Reason"
								placeholder="Explain why this session is being added (min. 10 characters)"
								required
							/>
						)}
					</form.AppField>

					{submissionError && (
						<CustomAlert variant="destructive" title="Error" description={submissionError} />
					)}
					{addMutation.error && (
						<CustomAlert
							variant="destructive"
							title="Error"
							description={addMutation.error.message}
						/>
					)}

					<form.Subscribe selector={(state) => state.values.reason}>
						{(reason) => (
							<form.AppForm>
								<form.SubmitButton
									withReset
									onReset={() => {
										form.reset();
										setClose();
									}}
									buttonText="Add session"
									disabled={reason.trim().length < 10}
									isLoading={addMutation.isPending}
								/>
							</form.AppForm>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
		</CustomModal>
	);
}
