import { useStore } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CustomAlert } from "@/components/ui/custom-alert";
import { FieldGroup } from "@/components/ui/field";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { sendEnquirySms } from "@/features/enquiries/services/enquiries.sms.api";
import type { EnquirySmsPreview } from "@/features/enquiries/services/enquiries.sms.api";
import { summarizeEnquirySmsFilters } from "@/features/enquiries/services/enquiry-sms";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import {
	type EnquirySmsFormSchema,
	type EnquirySmsRecipientsSchema,
	enquirySmsFormSchema,
} from "@/features/enquiries/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

function describeExclusions({ excluded }: EnquirySmsPreview) {
	const lines: string[] = [];
	if (excluded.noConsent) lines.push(`${excluded.noConsent} haven't agreed to receive SMS`);
	if (excluded.ineligibleStatus) {
		lines.push(`${excluded.ineligibleStatus} already converted (message members instead)`);
	}
	if (excluded.invalidPhone) lines.push(`${excluded.invalidPhone} have an invalid phone number`);
	if (excluded.notFound) lines.push(`${excluded.notFound} no longer exist`);
	return lines;
}

function PreviewSummary({ preview }: { preview: EnquirySmsPreview }) {
	const exclusions = describeExclusions(preview);

	if (preview.eligibleCount === 0) {
		return (
			<CustomAlert
				variant="destructive"
				title="No one can receive this message"
				description={exclusions.join("; ") || "No enquirers match."}
			/>
		);
	}

	return (
		<CustomAlert
			variant={exclusions.length ? "warning" : "info"}
			title={`${preview.eligibleCount} of ${preview.total} will receive this message`}
			description={
				exclusions.length
					? `Skipped: ${exclusions.join("; ")}.`
					: "Everyone selected has agreed to SMS."
			}
		/>
	);
}

type Props = {
	// Specific enquiries (detail page, selected rows) or the list's current filters.
	target: EnquirySmsRecipientsSchema;
	// Called once the messages are queued, e.g. to clear a row selection.
	onSent?: () => void;
};

export function SendEnquirySmsModal({ target, onSent }: Props) {
	const { setClose } = useModal();
	const queryClient = useQueryClient();
	const [step, setStep] = useState<"compose" | "confirm">("compose");

	const isBulk = !target.enquiryIds || target.enquiryIds.length > 1;
	const noFiltersApplied =
		!target.enquiryIds &&
		Object.keys(summarizeEnquirySmsFilters(target.filters ?? {})).length === 0;

	const { data: preview, error: previewError } = useQuery(enquiryQueries.smsPreview(target));
	const { data: templates, isLoading: templatesLoading } = useQuery(enquiryQueries.smsTemplates());

	const { isPending, mutate } = useFormUpsert<EnquirySmsFormSchema, unknown>({
		upsertFn: (values) => sendEnquirySms({ data: { ...target, ...values } }),
		entityName: "Message",
		queryKey: ["sms-broadcasts"],
		successMessage: { create: "Messages are being sent." },
		onSuccessCallback: () => {
			queryClient.invalidateQueries({ queryKey: enquiryQueries.all });
			onSent?.();
			setClose();
		},
	});

	const form = useAppForm({
		defaultValues: { smsTemplateId: null, content: "" } as EnquirySmsFormSchema,
		validators: { onSubmit: enquirySmsFormSchema },
		onSubmit: ({ value }) => {
			// A bulk send needs a second, explicit confirmation.
			if (isBulk && step === "compose") {
				setStep("confirm");
				return;
			}
			mutate(value);
		},
	});

	const [templateId, content] = useStore(form.store, (state) => [
		state.values.smsTemplateId,
		state.values.content,
	]);

	useEffect(() => {
		if (!templateId) return;
		const selected = templates?.find((template) => template.id === templateId);
		if (selected) form.setFieldValue("content", selected.content);
	}, [templateId, templates, form]);

	const cannotSend = !preview || preview.eligibleCount === 0;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			{previewError ? (
				<CustomAlert
					variant="destructive"
					title="Couldn't check recipients"
					description={previewError.message}
				/>
			) : preview ? (
				<PreviewSummary preview={preview} />
			) : (
				<Skeleton className="h-16 w-full" />
			)}

			{/* Kept mounted while confirming so the form keeps its values. */}
			<div className={step === "confirm" ? "hidden" : "space-y-4"}>
				<FieldGroup>
					{templatesLoading ? (
						<Skeleton className="w-full h-10" />
					) : (
						<form.AppField name="smsTemplateId">
							{(field) => (
								<field.Select label="SMS Template">
									{templates?.map(({ id, name }) => (
										<SelectItem key={id} value={id}>
											{toTitleCase(name.toLowerCase())}
										</SelectItem>
									))}
								</field.Select>
							)}
						</form.AppField>
					)}
					<form.AppField name="content">
						{(field) => (
							<field.Textarea
								required
								label="Message"
								placeholder="Your message... Use {firstName} and {lastName} to personalise."
								helperText="{firstName} and {lastName} are filled in for each person."
							/>
						)}
					</form.AppField>
				</FieldGroup>
				<div className="flex justify-end gap-2">
					<Button type="button" variant="outline" onClick={() => setClose()}>
						Cancel
					</Button>
					<Button type="submit" disabled={cannotSend || isPending}>
						<LoadingSwap isLoading={isPending}>
							{isBulk ? "Review and send" : "Send message"}
						</LoadingSwap>
					</Button>
				</div>
			</div>

			{step === "confirm" && preview && (
				<div className="space-y-4">
					{noFiltersApplied && (
						<CustomAlert
							variant="warning"
							title="No filters are applied"
							description="This goes to every enquirer who has agreed to SMS."
						/>
					)}
					<div className="space-y-1">
						<p className="text-sm text-muted-foreground">Message</p>
						<p className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm">{content}</p>
					</div>
					<p className="text-sm">
						This will send <strong>{preview.eligibleCount}</strong> SMS
						{preview.eligibleCount === 1 ? "" : "es"}. It can't be undone.
					</p>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={isPending}
							onClick={() => setStep("compose")}
						>
							Back
						</Button>
						<Button type="submit" disabled={cannotSend || isPending}>
							<LoadingSwap isLoading={isPending}>Send to {preview.eligibleCount}</LoadingSwap>
						</Button>
					</div>
				</div>
			)}
		</form>
	);
}
