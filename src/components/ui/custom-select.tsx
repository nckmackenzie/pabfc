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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Option } from "@/types/index.types";
import { ScrollArea } from "./scroll-area";

interface ComboBoxProps {
	items: Array<Option>;
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	commandPlaceholder?: string;
	isInvalid?: boolean;
	addNew?: React.ReactNode;
}

export function ComboBox({
	value,
	onChange,
	items,
	placeholder,
	commandPlaceholder,
	isInvalid,
	addNew,
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
						isInvalid && "border-destructive",
					)}
				>
					{value
						? items.find((item) => item.value === value)?.label
						: placeholder}
					<ChevronUpDownIcon className="opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="max-w-md p-0">
				<Command>
					<CommandInput
						placeholder={commandPlaceholder ?? placeholder}
						className="h-10 "
					/>
					<CommandList>
						<CommandEmpty>No options found.</CommandEmpty>
						<CommandGroup>
							<ScrollArea className="max-h-[300px] [&>div]:block!">
								{items.map((item) => (
									<CommandItem
										key={item.value}
										value={item.value}
										onSelect={(currentValue) => {
											onChange(currentValue === value ? "" : currentValue);
											setOpen(false);
										}}
									>
										{item.label}
										<CheckIcon
											className={cn(
												"ml-auto",
												value === item.value ? "opacity-100" : "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</ScrollArea>
						</CommandGroup>
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
