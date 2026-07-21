import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { CustomAlert } from "@/components/ui/custom-alert";
import CustomModal from "@/components/ui/custom-modal";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastContent } from "@/components/ui/toast-content";
import { useVoidPayment } from "@/features/receipts/hooks/use-void-payment";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { voidPaymentSchema } from "@/features/receipts/services/schemas";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

// The secondary explicit-confirmation checkbox lives only in this form's local
// state — the server schema (`voidPaymentSchema`) doesn't need to know about it.
const voidFormSchema = voidPaymentSchema.extend({
	confirmed: z.literal(true, { error: "You must confirm this action" }),
});

export function VoidPaymentModal({ paymentId }: { paymentId: string }) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const { data: payment, isLoading } = useQuery(paymentsQueries.detail(paymentId));
	const voidMutation = useVoidPayment();
	const [submissionError, setSubmissionError] = useState<string | null>(null);

	const form = useAppForm({
		defaultValues: {
			paymentId,
			voidReason: "",
			confirmed: false,
		},
		validators: {
			onSubmit: voidFormSchema,
		},
		onSubmit: ({ value }) => {
			setSubmissionError(null);
			voidMutation.mutate(
				{ paymentId: value.paymentId, voidReason: value.voidReason },
				{
					onSuccess: (result) => {
						if (!result.success) {
							setSubmissionError(result.error.message);
							return;
						}
						queryClient.invalidateQueries({ queryKey: ["receipts"] });
						toast.success((t) => (
							<ToastContent t={t} title="Receipt voided" message="Receipt voided successfully." />
						));
						setClose();
					},
				}
			);
		},
	});

	const billingMember = payment?.member;
	const coveredMembers =
		payment?.members && payment.members.length > 0
			? payment.members.map(({ member }) => member)
			: billingMember
				? [billingMember]
				: [];
	const memberNames = coveredMembers
		.map((member) => toTitleCase(`${member.firstName} ${member.lastName}`))
		.join(", ");

	return (
		<CustomModal
			title="Void receipt"
			subtitle="Cancel the membership this receipt created and reverse its journal entry."
		>
			{isLoading || !payment ? (
				<div className="space-y-3">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-2/3" />
				</div>
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<p className="text-sm text-muted-foreground">
							This will cancel{" "}
							<span className="font-semibold text-foreground">{memberNames || "this member"}</span>
							's {payment.plan ? `${toTitleCase(payment.plan.name)} ` : ""}membership
							{payment.membership && (
								<>
									{" "}
									({dateFormat(payment.membership.startDate, "long")} –{" "}
									{payment.membership.endDate
										? dateFormat(payment.membership.endDate, "long")
										: "ongoing"}
									)
								</>
							)}
							, delete the membership record, and post a reversing journal entry. This{" "}
							<strong>cannot be undone</strong>.
						</p>

						<form.AppField name="voidReason">
							{(field) => (
								<field.Textarea
									label="Void reason"
									placeholder="Explain why this receipt is being voided (min. 10 characters)"
									required
								/>
							)}
						</form.AppField>

						<form.AppField name="confirmed">
							{(field) => (
								<field.Checkbox label="I understand this cannot be undone and want to void this receipt." />
							)}
						</form.AppField>

						{submissionError && (
							<CustomAlert variant="destructive" title="Error" description={submissionError} />
						)}
						{voidMutation.error && (
							<CustomAlert
								variant="destructive"
								title="Error"
								description={voidMutation.error.message}
							/>
						)}

						<form.Subscribe
							selector={(state) => [state.values.confirmed, state.values.voidReason] as const}
						>
							{([confirmed, voidReason]) => (
								<form.AppForm>
									<form.SubmitButton
										withReset
										onReset={() => {
											form.reset();
											setClose();
										}}
										buttonText="Void receipt"
										buttonVariant="destructive"
										disabled={!confirmed || voidReason.trim().length < 10}
										isLoading={voidMutation.isPending}
									/>
								</form.AppForm>
							)}
						</form.Subscribe>
					</FieldGroup>
				</form>
			)}
		</CustomModal>
	);
}
