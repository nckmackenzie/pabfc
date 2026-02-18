import type { ComponentProps } from "react";
import type { DateRange } from "react-day-picker";
import { DatePicker } from "@/components/ui/date-range";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/lib/form";

export type DateRangePickerProps = {
	label: string;
	required?: boolean;
	helperText?: string;
	className?: string;
	fieldClassName?: string;
};

export function DateRangePickerField({
	label,
	required,
	helperText,
	fieldClassName,
	...props
}: DateRangePickerProps & ComponentProps<typeof DatePicker>) {
	const field = useFieldContext<DateRange>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	return (
		<Field data-invalid={isInvalid} className={fieldClassName}>
			{label.trim().length > 0 && (
				<FieldLabel htmlFor={field.name}>
					{label} {required && <span className="text-destructive">*</span>}
				</FieldLabel>
			)}
			<DatePicker
				initialDateRange={field.state.value}
				onDateChange={(range) => field.handleChange(range)}
				{...props}
			/>
			{helperText && <FieldDescription>{helperText}</FieldDescription>}
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
