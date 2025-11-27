import type { ComponentProps } from "react";
import type { TextFieldProps } from "@/components/form-components/textfield";
import {
	Select,
	SelectContent,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useFieldContext } from "@/lib/form";
import { cn } from "@/lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field";

export function FormSelect({
	children,
	label,
	required,
	helperText,
	fieldClassName,
	className,
	disabled,
	placeholder,
}: TextFieldProps & ComponentProps<"select">) {
	const field = useFieldContext<string>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Field data-invalid={isInvalid} className={fieldClassName}>
			<FieldLabel htmlFor={field.name}>
				{label} {required && <span className="text-destructive">*</span>}
			</FieldLabel>
			<Select
				onValueChange={(e) => field.handleChange(e)}
				value={field.state.value}
			>
				<SelectTrigger
					aria-invalid={isInvalid}
					id={field.name}
					onBlur={field.handleBlur}
					className={cn("h-10", className)}
					disabled={disabled}
				>
					<SelectValue placeholder={placeholder ?? "Select an option"} />
				</SelectTrigger>
				<SelectContent>{children}</SelectContent>
			</Select>
			{helperText && <FieldDescription>{helperText}</FieldDescription>}
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
