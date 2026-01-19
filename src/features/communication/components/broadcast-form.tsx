import { useStore } from "@tanstack/react-form";
import { useQueries } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";
import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { XIcon } from "@/components/ui/icons";
import { MultiSelectItem } from "@/components/ui/multi-select";
import { SelectItem } from "@/components/ui/select";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import {
	type BroadcastFormSchema,
	broadcastFormSchema,
} from "@/features/communication/services/schemas";
import { MEMBER_STATUS } from "@/features/members/lib/constants";
import { planQueries } from "@/features/plans/services/queries";
import { useAppForm } from "@/lib/form";
import { toTitleCase } from "@/lib/utils";

const FILTER_CRITERIA_OPTIONS = [
	{ label: "By Status", value: "by status" },
	{ label: "By Plan", value: "by plan" },
];

export function BroadcastForm() {
	const { templates: loaderTemplates, plans: loaderPlans } = getRouteApi(
		"/app/communication/",
	).useLoaderData();
	const submitTypeRef = useRef<"SUBMIT" | "SEND_TEST">("SUBMIT");
	const formRef = useRef<HTMLFormElement>(null);
	const [{ data: freshTemplates }, { data: freshPlans }] = useQueries({
		queries: [smsTemplateQueries.list(), planQueries.active()],
	});
	const { templates, plans } = useMemo(() => {
		return {
			templates: (freshTemplates || loaderTemplates).map((template) => ({
				value: template.id,
				label: toTitleCase(template.name),
			})),
			plans: (freshPlans || loaderPlans).map((plan) => ({
				value: plan.value,
				label: toTitleCase(plan.label),
			})),
		};
	}, [loaderTemplates, freshTemplates, loaderPlans, freshPlans]);
	const form = useAppForm({
		defaultValues: {
			filterCriteria: "by status",
			criteria: "",
			smsTemplateId: null,
			content: "",
			receipients: [],
			smsBroadcastStatus: "draft",
			submitType: "SUBMIT",
		} as BroadcastFormSchema,
		validators: {
			onSubmit: broadcastFormSchema,
		},
	});

	const [filterCriteria, receipients] = useStore(form.store, (state) => [
		state.values.filterCriteria,
		state.values.receipients,
	]);

	return (
		<div className="flex-1">
			<form
				onSubmit={(e) => {
					e.preventDefault();
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
					<form.AppField name="receipients">
						{(field) => (
							<field.MultiSelect
								required
								label="Receipients"
								placeholder="Select receipients"
								className="col-span-2"
							>
								{plans.map((plan) => (
									<MultiSelectItem key={plan.value} value={plan.value}>
										{plan.label}
									</MultiSelectItem>
								))}
							</field.MultiSelect>
						)}
					</form.AppField>
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
						>
							Send test to me
						</Button>
						<Button type="submit">
							<SendIcon />
							Send
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								form.reset();
							}}
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
