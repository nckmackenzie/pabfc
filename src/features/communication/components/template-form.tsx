import { FieldGroup } from "@/components/ui/field";
import {
	type TemplateFormSchema,
	templateFormSchema,
} from "@/features/communication/services/schemas";
import { useAppForm } from "@/lib/form";
import { TemplateEditor } from "./template-editor";

export function TemplateForm() {
	const form = useAppForm({
		defaultValues: {
			name: "",
			content: "",
			variables: [],
			description: "",
		} as TemplateFormSchema,
		validators: {
			onSubmit: templateFormSchema,
		},
	});
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
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
				<form.Field name="content">
					{(field) => (
						<TemplateEditor
							value={field.state.value}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
			</FieldGroup>
			<form.AppForm>
				<form.SubmitButton buttonText="Create Template" />
			</form.AppForm>
		</form>
	);
}
