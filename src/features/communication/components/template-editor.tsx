// components/template-editor.tsx
/** biome-ignore-all lint/a11y/noLabelWithoutControl: <> */
import { type ComponentProps, useState } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { VARIABLE_SOURCES } from "@/features/communication/lib/utils";
import { useFieldContext } from "@/lib/form";

export function TemplateEditor({ ...props }: ComponentProps<"textarea">) {
	const [cursorPos, setCursorPos] = useState(0);
	const field = useFieldContext<string>();
	const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
	const value = field.state.value;

	const insertVariable = (variable: string) => {
		const newValue =
			value.slice(0, cursorPos) + variable + value.slice(cursorPos);
		field.handleChange(newValue);
		setCursorPos(cursorPos + variable.length);
	};

	return (
		<Field className="space-y-4">
			<div>
				<FieldLabel htmlFor={field.name}>
					Template Content <span className="text-destructive">*</span>
				</FieldLabel>
				<Textarea
					value={value}
					onChange={(e) => {
						field.handleChange(e.target.value);
						setCursorPos(e.target.selectionStart);
					}}
					id={field.name}
					aria-invalid={isInvalid}
					onSelect={(e) => {
						const target = e.target as HTMLTextAreaElement;
						setCursorPos(target.selectionStart);
					}}
					className="field-sizing-content min-h-32"
					placeholder="Enter your SMS template..."
					{...props}
				/>
				{isInvalid && <FieldError errors={field.state.meta.errors} />}
				<p className="text-sm text-gray-500 mt-1">
					Characters: {value.length} / 160
				</p>
			</div>

			<div>
				<FieldLabel>Insert Variables</FieldLabel>
				<div className="flex flex-wrap gap-2">
					{Object.values(VARIABLE_SOURCES).map((variable) => (
						<button
							key={variable.field}
							type="button"
							onClick={() => insertVariable(`{${variable.field}}`)}
							className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
							title={variable.description}
						>
							{variable.field}
						</button>
					))}
				</div>
			</div>
		</Field>
	);
}
