import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/lib/form";

type CheckboxProps = {
	label: string;
	required?: boolean;
	helperText?: string;
	className?: string;
	fieldClassName?: string;
	switch?: boolean;
};

export function FormCheckbox(props: CheckboxProps) {
	const field = useFieldContext<boolean>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
	return (
		<Field
			data-invalid={isInvalid}
			className={props.fieldClassName}
			orientation="horizontal"
		>
			<Checkbox
				id={field.name}
				name={field.name}
				checked={field.state.value}
				onBlur={field.handleBlur}
				onCheckedChange={(e) => field.handleChange(e === true)}
				aria-invalid={isInvalid}
			/>

			<FieldContent>
				<FieldLabel htmlFor={field.name}>
					{props.label} {props.required ? "*" : ""}
				</FieldLabel>
				{props.helperText && (
					<FieldDescription>{props.helperText}</FieldDescription>
				)}
				{isInvalid && <FieldError errors={field.state.meta.errors} />}
			</FieldContent>
		</Field>
	);
}
