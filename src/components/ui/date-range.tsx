/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <none> */

import {
	endOfMonth,
	format,
	isEqual,
	startOfDay,
	startOfMonth,
	startOfYear,
	subDays,
	subMonths,
} from "date-fns";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@/components/ui/icons";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/re-ui-btn";
import { cn, generateRandomId } from "@/lib/utils";

type DateRangePickerProps = {
	initialDateRange?: DateRange;
	onDateChange?: (dateRange: DateRange) => void;
	onReset?: () => void;
	className?: string;
};

export function DatePicker({
	onDateChange,
	initialDateRange,
	onReset,
	className,
}: DateRangePickerProps) {
	const today = new Date();
	const presets = [
		{ label: "Today", range: { from: today, to: today } },
		{
			label: "Yesterday",
			range: { from: subDays(today, 1), to: subDays(today, 1) },
		},
		{ label: "Last 7 days", range: { from: subDays(today, 6), to: today } },
		{ label: "Last 30 days", range: { from: subDays(today, 29), to: today } },
		{ label: "Month to date", range: { from: startOfMonth(today), to: today } },
		{
			label: "Last month",
			range: {
				from: startOfMonth(subMonths(today, 1)),
				to: endOfMonth(subMonths(today, 1)),
			},
		},
		{ label: "Year to date", range: { from: startOfYear(today), to: today } },
	];

	const [month, setMonth] = useState(today);
	const defaultPreset = presets[2];
	const [date, setDate] = useState<DateRange | undefined>(
		initialDateRange || defaultPreset.range,
	); // Default: Last 7 days
	const [selectedPreset, setSelectedPreset] = useState<string | null>(
		defaultPreset.label,
	);

	const [isPopoverOpen, setIsPopoverOpen] = useState(false);

	useEffect(() => {
		setDate(initialDateRange || undefined);
	}, [initialDateRange]);

	const handleApply = () => {
		if (date) {
			setDate(date);
			onDateChange?.(date);
		}

		setIsPopoverOpen(false);
	};

	const handleReset = () => {
		setDate(undefined);
		setSelectedPreset(null);
		setIsPopoverOpen(false);
		onReset?.();
	};

	const handleSelect = (selected: DateRange | undefined) => {
		setDate({
			from: selected?.from || undefined,
			to: selected?.to || undefined,
		});
		setSelectedPreset(null); // Clear preset when manually selecting a range
	};

	// Update `selectedPreset` whenever `date` changes
	useEffect(() => {
		const matchedPreset = presets.find(
			(preset) =>
				isEqual(
					startOfDay(preset.range.from),
					startOfDay(date?.from || new Date(0)),
				) &&
				isEqual(
					startOfDay(preset.range.to),
					startOfDay(date?.to || new Date(0)),
				),
		);
		setSelectedPreset(matchedPreset?.label || null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [date]);

	return (
		<Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					mode="input"
					placeholder={!date?.from && !date?.to}
					className={cn("w-full md:max-w-lg", className)}
					size="lg"
				>
					<CalendarIcon />
					{date?.from ? (
						date.to ? (
							<>
								{format(date.from, "LLL dd, y")} -{" "}
								{format(date.to, "LLL dd, y")}
							</>
						) : (
							format(date.from, "LLL dd, y")
						)
					) : (
						<span>Pick a date range</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="center">
				<div className="flex max-sm:flex-col">
					<div className="relative border-border max-sm:order-1 max-sm:border-t sm:w-32">
						<div className="h-full border-border sm:border-e py-2">
							<div className="flex flex-col px-2 gap-0.5">
								{presets.map((preset, index) => (
									<Button
										key={generateRandomId(`preset-${index}`)}
										type="button"
										variant="ghost"
										className={cn(
											"h-8 w-full justify-start",
											selectedPreset === preset.label && "bg-accent",
										)}
										onClick={() => {
											setDate(preset.range);

											// Update the calendar to show the starting month of the selected range
											setMonth(preset.range.from || today);

											setSelectedPreset(preset.label); // Explicitly set the active preset
										}}
									>
										{preset.label}
									</Button>
								))}
							</div>
						</div>
					</div>
					<Calendar
						autoFocus
						mode="range"
						month={month}
						onMonthChange={setMonth}
						showOutsideDays={false}
						selected={date}
						onSelect={handleSelect}
						numberOfMonths={2}
					/>
				</div>
				<div className="flex items-center justify-end gap-1.5 border-t border-border p-3">
					<Button variant="outline" onClick={handleReset}>
						Reset
					</Button>
					<Button onClick={handleApply}>Apply</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
