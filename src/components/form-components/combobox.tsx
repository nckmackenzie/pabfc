import { ComboBox } from "@/components/ui/custom-select";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/lib/form";
import type { Option } from "@/types/index.types";

export type ComboboxProps = {
	label: string;
	required?: boolean;
	placeholder: string;
	helperText?: string;
	className?: string;
	items: Array<Option>;
};

export function ComboboxField({
	label,
	required,
	placeholder,
	helperText,
	className,
	items,
}: ComboboxProps) {
	const field = useFieldContext<string>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Field data-invalid={isInvalid} className={className}>
			<FieldLabel htmlFor={field.name}>
				{label} {required && <span className="text-destructive">*</span>}
			</FieldLabel>
			<ComboBox
				value={field.state.value}
				onChange={(value) => field.handleChange(value)}
				aria-invalid={isInvalid}
				placeholder={placeholder}
				items={items}
				isInvalid={isInvalid}
			/>
			{helperText && <FieldDescription>{helperText}</FieldDescription>}
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
