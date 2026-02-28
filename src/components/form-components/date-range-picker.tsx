import { format, parseISO } from "date-fns";
import type { ComponentProps, JSX } from "react";
import type { DateRange } from "react-day-picker";
import { DatePicker } from "@/components/ui/date-range";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/lib/form";

/** Date range where both bounds are ISO yyyy-MM-dd strings. */
export type StringDateRange = {
	from: string | undefined;
	to: string | undefined;
};

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

type BaseProps = {
	label: string;
	required?: boolean;
	helperText?: string;
	className?: string;
	fieldClassName?: string;
};

// Two overload signatures so callers get accurate field-context types.
export function DateRangePickerField(
	props: BaseProps & ComponentProps<typeof DatePicker> & { asString: true },
): JSX.Element;
export function DateRangePickerField(
	props: BaseProps & ComponentProps<typeof DatePicker> & { asString?: false },
): JSX.Element;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function DateRangePickerField({
	label,
	required,
	helperText,
	fieldClassName,
	asString,
	...props
}: BaseProps & ComponentProps<typeof DatePicker> & { asString?: boolean }) {
	// When asString is true the field stores StringDateRange; otherwise DateRange.
	const field = useFieldContext<DateRange | StringDateRange>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

	// Convert the stored value (string or Date) → DateRange for the picker UI.
	const toDateRange = (
		value: DateRange | StringDateRange | undefined,
	): DateRange | undefined => {
		if (!value) return undefined;
		if (!asString) return value as DateRange;
		const s = value as StringDateRange;
		return {
			from: s.from ? parseISO(s.from) : undefined,
			to: s.to ? parseISO(s.to) : undefined,
		};
	};

	const handleChange = (range: DateRange) => {
		if (asString) {
			field.handleChange({
				from: range.from ? format(range.from, "yyyy-MM-dd") : undefined,
				to: range.to ? format(range.to, "yyyy-MM-dd") : undefined,
			} satisfies StringDateRange);
		} else {
			field.handleChange(range);
		}
	};

	const handleReset = () => {
		if (asString) {
			field.handleChange({
				from: undefined,
				to: undefined,
			} satisfies StringDateRange);
		} else {
			field.handleChange({ from: undefined, to: undefined } as DateRange);
		}
	};

	return (
		<Field data-invalid={isInvalid} className={fieldClassName}>
			{label.trim().length > 0 && (
				<FieldLabel htmlFor={field.name}>
					{label} {required && <span className="text-destructive">*</span>}
				</FieldLabel>
			)}
			<DatePicker
				initialDateRange={toDateRange(
					field.state.value as DateRange | StringDateRange,
				)}
				onDateChange={handleChange}
				onReset={handleReset}
				{...props}
			/>
			{helperText && <FieldDescription>{helperText}</FieldDescription>}
			{isInvalid && <FieldError errors={field.state.meta.errors} />}
		</Field>
	);
}
