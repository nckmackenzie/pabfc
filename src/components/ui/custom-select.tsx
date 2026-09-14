import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { CheckIcon, ChevronUpDownIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Option } from "@/types/index.types";

export type ComboBoxItem = Option & {
	/** Optional non-selectable section heading the item is listed under. */
	group?: string;
};

interface ComboBoxProps {
	items: Array<ComboBoxItem>;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	commandPlaceholder?: string;
	isInvalid?: boolean;
	addNew?: React.ReactNode;
	disabled?: boolean;
}

// Keeps first-seen group order so callers control how sections are sorted.
function groupItems(items: Array<ComboBoxItem>) {
	const groups = new Map<string | undefined, Array<ComboBoxItem>>();

	for (const item of items) {
		const bucket = groups.get(item.group) ?? [];
		bucket.push(item);
		groups.set(item.group, bucket);
	}

	return Array.from(groups, ([heading, groupedItems]) => ({ heading, items: groupedItems }));
}

export function ComboBox({
	value,
	onChange,
	items,
	placeholder,
	commandPlaceholder,
	isInvalid,
	addNew,
	disabled,
}: ComboBoxProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"w-full justify-between h-10 shadow-none!",
						isInvalid && "border-destructive"
					)}
					disabled={disabled}
				>
					{value ? items.find((item) => item.value === value)?.label : placeholder}
					<ChevronUpDownIcon className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="max-w-md p-0">
				<Command>
					<CommandInput placeholder={commandPlaceholder ?? placeholder} className="h-10 " />
					<CommandList>
						<CommandEmpty>No options found.</CommandEmpty>
						{groupItems(items).map(({ heading, items: groupedItems }) => (
							<CommandGroup key={heading ?? "ungrouped"} heading={heading}>
								{groupedItems.map((item) => (
									<CommandItem
										key={item.value}
										value={item.label}
										onSelect={() => {
											onChange(item.value === value ? "" : item.value);
											setOpen(false);
										}}
									>
										{item.label}
										<CheckIcon
											className={cn("ml-auto", value === item.value ? "opacity-100" : "opacity-0")}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
					{addNew && (
						<>
							<CommandSeparator />
							<CommandGroup>{addNew}</CommandGroup>
						</>
					)}
				</Command>
			</PopoverContent>
		</Popover>
	);
}
