import { useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { SendIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { XIcon } from "@/components/ui/icons";
import { MultiSelectItem } from "@/components/ui/multi-select";
import { SelectItem } from "@/components/ui/select";
import { ToastContent } from "@/components/ui/toast-content";
import { useFormData } from "@/features/communication/hooks/use-get-form-data";
import { FILTER_CRITERIA_OPTIONS } from "@/features/communication/lib/constants";
import { getMembers } from "@/features/communication/lib/utils";
import { sendBroadCast } from "@/features/communication/services/communication.api";
import {
	type BroadcastFormSchema,
	broadcastFormSchema,
} from "@/features/communication/services/schemas";
import { MEMBER_STATUS } from "@/features/members/lib/constants";
import { useFormMutation } from "@/hooks/use-form-mutation";
import { useAppForm } from "@/lib/form";

export function BroadcastForm() {
	const { templates, plans, freshTemplates, members } = useFormData();
	const submitTypeRef = useRef<"SUBMIT" | "SEND_TEST">("SUBMIT");
	const formRef = useRef<HTMLFormElement>(null);
	const queryClient = useQueryClient();

	const { isPending, mutate } = useFormMutation({
		createFn: (values: BroadcastFormSchema) => sendBroadCast({ data: values }),
		entityName: "broadcast",
		queryKey: ["sms-broadcasts"],
		successMessage: {
			create: "Broadcast sent successfully",
		},
	});

	const form = useAppForm({
		defaultValues: {
			filterCriteria: "by status",
			criteria: null,
			smsTemplateId: null,
			content: "",
			receipients: [],
			smsBroadcastStatus: "draft",
			submitType: "SUBMIT",
		} as BroadcastFormSchema,
		validators: {
			onSubmit: broadcastFormSchema,
		},
		onSubmit: ({ value }) => {
			if (
				value.receipients.length === 0 &&
				submitTypeRef.current === "SUBMIT"
			) {
				toast((t) => (
					<ToastContent
						t={t}
						title="No receipients selected"
						message="Please select at least one receipient"
					/>
				));
				return;
			}
			mutate(
				{ data: { ...value, submitType: submitTypeRef.current } },
				{
					onSuccess: () => {
						if (submitTypeRef.current === "SEND_TEST") {
							return;
						}
						form.reset();
						queryClient.invalidateQueries({
							queryKey: ["sms-templates"],
						});
					},
					onSettled: () => {
						submitTypeRef.current = "SUBMIT";
					},
				},
			);
		},
	});

	const [filterCriteria, receipients, templateId, criteria] = useStore(
		form.store,
		(state) => [
			state.values.filterCriteria,
			state.values.receipients,
			state.values.smsTemplateId,
			state.values.criteria,
		],
	);

	useEffect(() => {
		if (templateId) {
			const template = freshTemplates?.find(
				(template) => template.id === templateId,
			);
			if (template) {
				form.setFieldValue("content", template.content);
			}
		}
	}, [templateId, freshTemplates, form]);

	useEffect(() => {
		form.setFieldValue("receipients", []);
		if (!filterCriteria || filterCriteria === "specific members") {
			return;
		}
		if (
			(filterCriteria === "by plan" || filterCriteria === "by status") &&
			!criteria
		) {
			return;
		}
		getMembers(filterCriteria, criteria).then((members) => {
			form.setFieldValue(
				"receipients",
				members.map((member) => member.value),
			);
		});
	}, [filterCriteria, criteria, form]);

	return (
		<div className="flex-1">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					console.log("Native form submitted");
					form.handleSubmit();
				}}
				ref={formRef}
				className="space-y-4"
			>
				<FieldGroup className="grid md:grid-cols-2 gap-4">
					<form.AppField name="filterCriteria">
						{(field) => (
							<field.Select required label="Filter Criteria">
								{FILTER_CRITERIA_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="criteria">
						{(field) => (
							<field.Select
								required
								label={filterCriteria === "by plan" ? "Plan" : "Status"}
								placeholder={
									filterCriteria === "by plan" ? "Select plan" : "Select status"
								}
								disabled={
									filterCriteria === "all members" ||
									filterCriteria === "specific members"
								}
							>
								{(filterCriteria === "by plan" ? plans : MEMBER_STATUS).map(
									(option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									),
								)}
							</field.Select>
						)}
					</form.AppField>
					{filterCriteria === "specific members" && (
						<form.AppField name="receipients">
							{(field) => (
								<field.MultiSelect
									required
									label="Receipients"
									placeholder="Select receipients"
									className="col-span-2"
								>
									{members.map((member) => (
										<MultiSelectItem key={member.value} value={member.value}>
											{member.label}
										</MultiSelectItem>
									))}
								</field.MultiSelect>
							)}
						</form.AppField>
					)}
					<form.AppField name="smsTemplateId">
						{(field) => (
							<field.Select
								required
								label="Template"
								fieldClassName="col-span-2"
							>
								{templates.map((template) => (
									<SelectItem key={template.value} value={template.value}>
										{template.label}
									</SelectItem>
								))}
							</field.Select>
						)}
					</form.AppField>
					<form.AppField name="content">
						{(field) => (
							<field.Textarea
								required
								label="Content"
								placeholder="Enter content"
								fieldClassName="col-span-2 "
								className="min-h-32"
							/>
						)}
					</form.AppField>
				</FieldGroup>
				<FieldGroup className="flex md:flex-row flex-col items-center gap-2">
					<p className="text-xs text-muted-foreground">
						{receipients.length === 0
							? "No one will receive this message! ☹️"
							: receipients.length === 1
								? "1 person will receive this message"
								: `Approx. ${receipients.length} members will receive this message`}
					</p>
					<div className="ml-auto flex gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => {
								submitTypeRef.current = "SEND_TEST";
								formRef.current?.requestSubmit();
							}}
							className="text-muted-foreground"
							disabled={isPending}
						>
							Send test to me
						</Button>
						<Button type="submit" disabled={isPending}>
							<SendIcon />
							Send
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								form.reset();
							}}
							disabled={isPending}
						>
							<XIcon />
							Cancel
						</Button>
					</div>
				</FieldGroup>
			</form>
		</div>
	);
}
