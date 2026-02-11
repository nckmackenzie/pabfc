import type { ComponentProps, InputHTMLAttributes } from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldContext } from "@/lib/form";
import { PasswordInput } from "../ui/password-input";

export type TextFieldProps = {
	label: string;
	required?: boolean;
	placeholder?: string;
	helperText?: string;
	className?: string;
	fieldClassName?: string;
	isPassword?: boolean;
	type?: "text" | "number" | "email" | "password" | "tel" | "url" | "date";
} & Omit<
	InputHTMLAttributes<HTMLInputElement>,
	"type" | "value" | "onChange" | "onBlur"
>;

export function TextField({
	label,
	required,
	placeholder,
	helperText,
	className,
	fieldClassName,
	type = "text",
	isPassword = false,
	...props
}: TextFieldProps & ComponentProps<"input">) {
	const field = useFieldContext();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
	const isNumber = type === "number";
	const isDate = type === "date";

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const rawValue = e.target.value;
		const value = isNumber
			? +rawValue
			: isDate && rawValue === ""
				? null
				: rawValue;
		field.handleChange(value);
	};
	return (
		<Field data-invalid={isInvalid} className={fieldClassName}>
			<FieldLabel htmlFor={field.name}>
				{label} {required && <span className="text-destructive">*</span>}
			</FieldLabel>
			{!isPassword ? (
				<Input
					value={field.state.value as string}
					onBlur={field.handleBlur}
					onChange={handleChange}
					id={field.name}
					aria-invalid={isInvalid}
					placeholder={placeholder}
					className={className}
					type={type}
					{...props}
				/>
			) : (
				<PasswordInput
					value={field.state.value as string}
					onBlur={field.handleBlur}
					onChange={handleChange}
					id={field.name}
					aria-invalid={isInvalid}
					placeholder={placeholder}
					className={className}
					{...props}
				/>
			)}
			{helperText && <FieldDescription>{helperText}</FieldDescription>}
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
