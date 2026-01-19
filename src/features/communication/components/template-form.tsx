import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { CheckIcon, TrashIcon } from "@/components/ui/icons";
import { LoadingSwap } from "@/components/ui/loading-swap";
import {
	type TemplateFormSchema,
	templateFormSchema,
} from "@/features/communication/services/schemas";
import { useFormUpsert } from "@/hooks/use-form-upsert";
import { useIsMobile } from "@/hooks/use-mobile";
import { useModal } from "@/integrations/modal-provider";
import { useAppForm } from "@/lib/form";
import { upsertTemplate } from "../services/communication.api";

export function TemplateForm({ template }: { template?: TemplateFormSchema }) {
	const { setClose } = useModal();
	const isMobile = useIsMobile();
	const { isPending, mutate } = useFormUpsert({
		upsertFn: (values: TemplateFormSchema) => upsertTemplate({ data: values }),
		entityName: "SMS Template",
		queryKey: ["sms-templates"],
	});

	const form = useAppForm({
		defaultValues:
			template ??
			({
				name: "",
				content: "",
				variables: [],
				description: "",
			} as TemplateFormSchema),
		validators: {
			onSubmit: templateFormSchema,
		},
		onSubmit: ({ value }) => {
			mutate(
				{ ...value, id: template?.id },
				{
					onSuccess: () => {
						handleReset();
					},
				},
			);
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
				<form.AppField name="name">
					{(field) => (
						<field.Input
							label="Name"
							required
							placeholder="Name of template..keep it short and descriptive"
						/>
					)}
				</form.AppField>
				<form.AppField name="description">
					{(field) => (
						<field.Input
							label="Description"
							required
							placeholder="Description of template"
						/>
					)}
				</form.AppField>
				<form.AppField name="content">
					{(field) => <field.TemplateEditor />}
				</form.AppField>
			</FieldGroup>
			<form.Subscribe selector={(state) => [state.isSubmitting]}>
				{([isSubmitting]) => (
					<Field
						orientation={isMobile ? "vertical" : "horizontal"}
						className="flex items-center gap-2"
					>
						<Button
							type="submit"
							className="flex"
							disabled={isSubmitting || isPending}
						>
							<LoadingSwap isLoading={isSubmitting || !!isPending}>
								<CheckIcon />
								{template ? "Update Template" : "Create Template"}
							</LoadingSwap>
						</Button>
						<Button
							type="button"
							disabled={isSubmitting}
							variant="outline"
							onClick={handleReset}
						>
							Cancel
						</Button>
						{template && (
							<Button variant="destructive" className="ml-auto">
								<TrashIcon />
								Delete
							</Button>
						)}
					</Field>
				)}
			</form.Subscribe>
		</form>
	);
}
