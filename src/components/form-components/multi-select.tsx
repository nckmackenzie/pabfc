import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import {
	MultiSelect,
	MultiSelectContent,
	MultiSelectGroup,
	MultiSelectTrigger,
	MultiSelectValue,
} from "@/components/ui/multi-select";
import { useFieldContext } from "@/lib/form";

export type MultiSelectFieldProps = {
	label: string;
	required?: boolean;
	placeholder: string;
	helperText?: string;
	className?: string;
	children: React.ReactNode;
};

export function MultiSelectField({
	label,
	required,
	placeholder,
	helperText,
	className,
	children,
}: MultiSelectFieldProps) {
	const field = useFieldContext<string[]>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Field data-invalid={isInvalid} className={className}>
			<FieldLabel htmlFor={field.name}>
				{label} {required && <span className="text-destructive">*</span>}
			</FieldLabel>
			<MultiSelect
				onValuesChange={field.handleChange}
				values={field.state.value}
			>
				<MultiSelectTrigger
					id={field.name}
					className="w-full shadow-none min-h-10! hover:bg-transparent"
					aria-invalid={isInvalid}
				>
					<MultiSelectValue
						overflowBehavior="wrap-when-open"
						placeholder={placeholder || "Select options..."}
					/>
				</MultiSelectTrigger>
				<MultiSelectContent>
					<MultiSelectGroup>{children}</MultiSelectGroup>
				</MultiSelectContent>
			</MultiSelect>
			{helperText && <FieldDescription>{helperText}</FieldDescription>}
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
