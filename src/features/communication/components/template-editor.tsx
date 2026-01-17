// components/template-editor.tsx
/** biome-ignore-all lint/a11y/noLabelWithoutControl: <> */
import { useState } from "react";
import { VARIABLE_SOURCES } from "@/features/communication/lib/utils";

interface TemplateEditorProps {
	value: string;
	onChange: (value: string) => void;
}

export function TemplateEditor({ value, onChange }: TemplateEditorProps) {
	const [cursorPos, setCursorPos] = useState(0);

	const insertVariable = (variable: string) => {
		const newValue =
			value.slice(0, cursorPos) + variable + value.slice(cursorPos);
		onChange(newValue);
		setCursorPos(cursorPos + variable.length);
	};

	return (
		<div className="space-y-4">
			<div>
				<label className="block text-sm font-medium mb-2">
					Template Content
				</label>
				<textarea
					value={value}
					onChange={(e) => {
						onChange(e.target.value);
						setCursorPos(e.target.selectionStart);
					}}
					onSelect={(e) => {
						const target = e.target as HTMLTextAreaElement;
						setCursorPos(target.selectionStart);
					}}
					className="w-full h-32 p-3 border rounded-lg"
					placeholder="Enter your SMS template..."
				/>
				<p className="text-sm text-gray-500 mt-1">
					Characters: {value.length} / 160
				</p>
			</div>

			<div>
				<label className="block text-sm font-medium mb-2">
					Insert Variables
				</label>
				<div className="flex flex-wrap gap-2">
					{Object.values(VARIABLE_SOURCES).map((variable) => (
						<button
							key={variable.field}
							type="button"
							onClick={() => insertVariable(`{${variable.field}}`)}
							className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
							//   title={variable.description}
						>
							{variable.field}
						</button>
					))}
				</div>
			</div>

			<div className="p-3 bg-gray-50 rounded">
				<p className="text-sm font-medium mb-1">Preview:</p>
				<p className="text-sm">
					{value || "Your template will appear here..."}
				</p>
			</div>
		</div>
	);
}
