import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { CustomAlert } from "@/components/ui/custom-alert";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import { useWaiveSessionUsage } from "@/features/session-usage/hooks/use-waive-session-usage";
import { waiveSessionUsageSchema } from "@/features/session-usage/services/schemas";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";

export function WaiveSessionUsageModal({
	memberId,
	usageId,
}: {
	memberId: string;
	usageId: string;
}) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const waiveMutation = useWaiveSessionUsage();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: {
			usageId,
			reason: "",
		},
		validators: {
			onSubmit: waiveSessionUsageSchema,
		},
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			waiveMutation.mutate(value, {
				onSuccess: (result) => {
					if (!result.success) {
						setSubmissionError(result.error.message);
						return;
					}
					queryClient.invalidateQueries({ queryKey: ["members", "overview", memberId] });
					queryClient.invalidateQueries({ queryKey: ["members", "session-usage-history", memberId] });
					queryClient.invalidateQueries({ queryKey: ["members", "attendance-history", memberId] });
					toast.success((t) => (
						<ToastContent t={t} title="Session waived" message="The session has been waived." />
					));
					setClose();
				},
			});
		},
	});

	return (
		<CustomModal
			title="Waive this session"
			subtitle="This frees up one session and may reactivate the membership if it had already run out."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.AppField name="reason">
						{(field) => (
							<field.Textarea
								label="Reason"
								placeholder="Explain why this session is being waived (min. 10 characters)"
								required
							/>
						)}
					</form.AppField>

					{submissionError && (
						<CustomAlert variant="destructive" title="Error" description={submissionError} />
					)}
					{waiveMutation.error && (
						<CustomAlert
							variant="destructive"
							title="Error"
							description={waiveMutation.error.message}
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
									buttonText="Waive session"
									buttonVariant="destructive"
									disabled={reason.trim().length < 10}
									isLoading={waiveMutation.isPending}
								/>
							</form.AppForm>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
		</CustomModal>
	);
}
