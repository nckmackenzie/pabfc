import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { CustomAlert } from "@/components/ui/custom-alert";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { ToastContent } from "@/components/ui/toast-content";
import { useRejectComplimentaryRequest } from "@/features/receipts/hooks/use-reject-complimentary-request";
import { complimentaryQueries } from "@/features/receipts/services/complimentary.queries";
import { rejectComplimentaryRequestSchema } from "@/features/receipts/services/complimentary.schemas";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";

// The secondary explicit-confirmation checkbox lives only in this form's local
// state — the server schema doesn't need to know about it.
const rejectFormSchema = rejectComplimentaryRequestSchema.extend({
	confirmed: z.literal(true, { error: "You must confirm this action" }),
});

export function RejectComplimentaryRequestModal({ requestId }: { requestId: string }) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const rejectMutation = useRejectComplimentaryRequest();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: { requestId, rejectionReason: "", confirmed: false },
		validators: { onSubmit: rejectFormSchema },
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			rejectMutation.mutate(
				{ requestId: value.requestId, rejectionReason: value.rejectionReason },
				{
					onSuccess: (result) => {
						if (!result.success) {
							setSubmissionError(result.error.message);
							return;
						}
						queryClient.invalidateQueries({ queryKey: complimentaryQueries.all });
						toast.success((t) => (
							<ToastContent
								t={t}
								title="Request rejected"
								message="Complimentary membership request rejected."
							/>
						));
						setClose();
					},
				}
			);
		},
	});

	return (
		<CustomModal
			title="Reject complimentary request"
			subtitle="This will decline the request and notify the requester."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<FieldGroup>
					<form.AppField name="rejectionReason">
						{(field) => (
							<field.Textarea
								label="Rejection reason"
								placeholder="Explain why this request is being rejected (min. 10 characters)"
								required
							/>
						)}
					</form.AppField>

					<form.AppField name="confirmed">
						{(field) => <field.Checkbox label="I understand this will reject the request." />}
					</form.AppField>

					{submissionError && (
						<CustomAlert variant="destructive" title="Error" description={submissionError} />
					)}
					{rejectMutation.error && (
						<CustomAlert
							variant="destructive"
							title="Error"
							description={rejectMutation.error.message}
						/>
					)}

					<form.Subscribe
						selector={(state) => [state.values.confirmed, state.values.rejectionReason] as const}
					>
						{([confirmed, rejectionReason]) => (
							<form.AppForm>
								<form.SubmitButton
									withReset
									onReset={() => {
										form.reset();
										setClose();
									}}
									buttonText="Reject request"
									buttonVariant="destructive"
									disabled={!confirmed || rejectionReason.trim().length < 10}
									isLoading={rejectMutation.isPending}
								/>
							</form.AppForm>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
		</CustomModal>
	);
}
