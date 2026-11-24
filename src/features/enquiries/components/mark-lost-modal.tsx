import { FieldGroup } from "@/components/ui/field";
import { SelectItem } from "@/components/ui/select";
import { ENQUIRY_LOST_REASON_OPTIONS } from "@/features/enquiries/lib/constants";
import { updateEnquiryStatus } from "@/features/enquiries/services/enquiries.mutations.api";
import { type MarkLostFormSchema, markLostFormSchema } from "@/features/enquiries/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";

export function MarkLostModal({ enquiryId }: { enquiryId: string }) {
	const { setClose } = useModal();

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (values: MarkLostFormSchema) =>
			updateEnquiryStatus({ data: { id: enquiryId, status: "lost", ...values } }),
		entityName: "Enquiry",
		queryKey: ["enquiries"],
		successMessage: { create: "Enquiry marked as lost." },
	});

	const form = useAppForm({
		defaultValues: {
			lostReason: undefined,
			lostReasonNotes: null,
		} as unknown as MarkLostFormSchema,
		validators: { onSubmit: markLostFormSchema },
		onSubmit: ({ value }) => {
			mutate(value, { onSuccess: handleReset });
		},
	});

	function handleReset() {
		form.reset();
		setClose();
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<FieldGroup>
				<form.AppField name="lostReason">
					{(field) => (
						<field.Select label="Reason" placeholder="Why was this enquiry lost?" required>
							{ENQUIRY_LOST_REASON_OPTIONS.map((reason) => (
								<SelectItem key={reason.value} value={reason.value}>
									{reason.label}
								</SelectItem>
							))}
						</field.Select>
					)}
				</form.AppField>
				<form.AppField name="lostReasonNotes">
					{(field) => (
						<field.Textarea
							className="resize-none"
							label="Notes"
							placeholder="Anything worth remembering (optional)"
						/>
					)}
				</form.AppField>
			</FieldGroup>
			<FieldGroup>
				<form.AppForm>
					<form.SubmitButton
						isLoading={isPending}
						buttonText="Mark as lost"
						onReset={handleReset}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}
