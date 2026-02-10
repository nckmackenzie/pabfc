import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { FormCheckbox, Switch } from "@/components/form-components/checkbox";
import { ComboboxField } from "@/components/form-components/combobox";
import { MultiSelectField } from "@/components/form-components/multi-select";
import { FormSelect } from "@/components/form-components/select";
import { SubmitButton } from "@/components/form-components/submit-button";
import { TextAreaField } from "@/components/form-components/textarea";
import { TextField } from "@/components/form-components/textfield";
import { TemplateEditor } from "@/features/communication/components/template-editor";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
	createFormHookContexts();

export const { useAppForm, withForm } = createFormHook({
	fieldComponents: {
		Input: TextField,
		Textarea: TextAreaField,
		Select: FormSelect,
		Checkbox: FormCheckbox,
		Combobox: ComboboxField,
		MultiSelect: MultiSelectField,
		TemplateEditor,
		Switch,
	},
	formComponents: {
		SubmitButton,
	},
	fieldContext,
	formContext,
});
