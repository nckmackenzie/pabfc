import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { FieldGroup } from "@/components/ui/field";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { sendBroadCast } from "@/features/communication/services/communication.api";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import {
	type SendMessageSchema,
	sendMessageSchema,
} from "@/features/members/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

export function SendMessageModal({ memberId }: { memberId: string }) {
	const { setClose } = useModal();

	const { isPending, mutate } = useFormUpsert({
		upsertFn: (values: SendMessageSchema & { id?: string }) =>
			sendBroadCast({
				data: {
					...values,
					receipients: [memberId],
					filterCriteria: "specific members",
					submitType: "SUBMIT",
					smsBroadcastStatus: "draft",
				},
			}),
		queryKey: ["sms-broadcasts"],
		entityName: "Message",
		successMessage: {
			create: "Message sent successfully!",
		},
		errorMessage: {
			create: "Failed to send message. Please try again",
		},
	});

	const {
		data: templates,
		isLoading,
		error,
	} = useQuery(smsTemplateQueries.list());
	const form = useAppForm({
		defaultValues: {
			memberId,
			content: "",
			smsTemplateId: null,
		} as SendMessageSchema,
		validators: {
			onSubmit: sendMessageSchema,
		},
		onSubmit: ({ value }) => {
			mutate(value, {
				onSuccess: () => {
					handleReset();
				},
			});
		},
	});

	const [templateId] = useStore(form.store, (state) => [
		state.values.smsTemplateId,
	]);

	useEffect(() => {
		if (!templateId) return;

		const selectedTemplate = templates?.find((t) => t.id === templateId);
		if (selectedTemplate) {
			form.setFieldValue("content", selectedTemplate.content);
		}
	}, [templateId, form, templates]);

	if (error) {
		return <AlertErrorComponent message={error.message} />;
	}

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
				{isLoading ? (
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
							placeholder="Your message..."
						/>
					)}
				</form.AppField>
			</FieldGroup>
			<FieldGroup>
				<form.AppForm>
					<form.SubmitButton
						isLoading={isPending}
						buttonText="Send Message"
						onReset={handleReset}
					/>
				</form.AppForm>
			</FieldGroup>
		</form>
	);
}
