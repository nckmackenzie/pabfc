import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format, isToday } from "date-fns";
import { Clock3Icon, ScanLineIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AttendanceTimelineRecord } from "@/features/attendances/services/attendance.api";
import { attendanceQueries } from "@/features/attendances/services/queries";
import { MemberAvatar } from "@/features/members/components/member-table";
import { useFilters } from "@/hooks/use-filters";
import { cn, toTitleCase } from "@/lib/utils";

function StatChip({
	label,
	value,
	color,
}: {
	label: string;
	value: string;
	color: string;
}) {
	return (
		<div className="flex items-center gap-2 rounded-full border border-muted-foreground/20 bg-muted px-3.5 py-1.5 text-xs text-muted-foreground">
			<span className={cn("h-1.5 w-1.5 rounded-full", color)} />
			<span>{label}</span>
			<span className="font-mono text-foreground">{value}</span>
		</div>
	);
}

export function AttendanceTable() {
	const { filters } = useFilters(getRouteApi("/app/attendances/").id);
	const { data } = useSuspenseQuery(attendanceQueries.list(filters));
	const [pageSize, setPageSize] = useState(20);
	const [pageIndex, setPageIndex] = useState(0);
	const filterKey = `${filters.from}:${filters.to}:${filters.q ?? ""}`;
	const lastFilterKeyRef = useRef(filterKey);

	useEffect(() => {
		if (lastFilterKeyRef.current !== filterKey) {
			lastFilterKeyRef.current = filterKey;
			setPageIndex(0);
		}
	}, [filterKey]);

	const totalRecords = data.length;
	const pageCount = Math.max(1, Math.ceil(totalRecords / pageSize));
	const safePageIndex = Math.min(pageIndex, pageCount - 1);
	const pageStart = safePageIndex * pageSize;
	const pageEnd = Math.min(pageStart + pageSize, totalRecords);

	const paginatedRecords = useMemo(
		() => data.slice(pageStart, pageEnd),
		[data, pageEnd, pageStart],
	);
	const dayGroups = useMemo(
		() => groupAttendanceByDay(paginatedRecords),
		[paginatedRecords],
	);

	useEffect(() => {
		if (pageIndex !== safePageIndex) {
			setPageIndex(safePageIndex);
		}
	}, [pageIndex, safePageIndex]);

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap gap-4">
				<StatChip
					color="bg-emerald-500"
					label="Total Check-ins"
					value={data.length.toString()}
				/>
				<StatChip color="bg-amber-500" label="Peak Hour" value={"06:00 AM"} />
			</div>

			{data.length > 0 ? (
				<div className="space-y-6">
					{dayGroups.map((dayGroup) => (
						<section
							key={dayGroup.key}
							className="space-y-4 border border-border/60 p-2 shadow-sm rounded-2xl"
						>
							<div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg  bg-background/95 px-4 py-3 backdrop-blur">
								<div>
									<p className="text-sm font-semibold text-foreground">
										{dayGroup.label}
									</p>
									<p className="text-xs text-muted-foreground">
										{dayGroup.dateLabel}
									</p>
								</div>
								<div className="h-px flex-1 bg-border" />
								<Badge variant="secondary" className="font-mono">
									{dayGroup.records.length} entries
								</Badge>
							</div>

							<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
								{dayGroup.records.map((record) => (
									<AttendanceCard key={record.id.toString()} record={record} />
								))}
							</div>
						</section>
					))}

					<div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
							<div className="flex items-center gap-2">
								<p className="text-sm font-medium">Rows per page</p>
								<Select
									value={`${pageSize}`}
									onValueChange={(value) => {
										setPageSize(Number(value));
										setPageIndex(0);
									}}
								>
									<SelectTrigger size="sm" className="h-8 w-[70px]">
										<SelectValue placeholder={pageSize} />
									</SelectTrigger>
									<SelectContent side="top">
										{[10, 20, 25, 30, 40, 50].map((size) => (
											<SelectItem key={size} value={`${size}`}>
												{size}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<p className="text-sm text-muted-foreground">
								Showing{" "}
								<span className="font-medium text-foreground">
									{pageStart + 1}-{pageEnd}
								</span>{" "}
								of{" "}
								<span className="font-medium text-foreground">
									{totalRecords}
								</span>{" "}
								check-ins
							</p>
						</div>

						<div className="flex items-center gap-2 self-end md:self-auto">
							<div className="mr-2 text-sm font-medium">
								Page {safePageIndex + 1} of {pageCount}
							</div>
							<Button
								variant="outline"
								size="icon-sm"
								onClick={() =>
									setPageIndex((current) => Math.max(0, current - 1))
								}
								disabled={safePageIndex === 0}
							>
								<span className="sr-only">Go to previous page</span>
								<ArrowLeftIcon />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								onClick={() =>
									setPageIndex((current) =>
										Math.min(pageCount - 1, current + 1),
									)
								}
								disabled={safePageIndex >= pageCount - 1}
							>
								<span className="sr-only">Go to next page</span>
								<ArrowRightIcon />
							</Button>
						</div>
					</div>
				</div>
			) : (
				<div className="rounded-[1.75rem] border border-dashed border-border/70 bg-muted/20 px-6 py-14">
					<EmptyState
						title="No attendance punches"
						description={`No check-ins found for ${formatRangeLabel(filters.from, filters.to)}.`}
						icon={<ScanLineIcon className="h-5 w-5" />}
					/>
				</div>
			)}
		</div>
	);
}

function AttendanceCard({ record }: { record: AttendanceTimelineRecord }) {
	return (
		<article className="group relative overflow-hidden rounded-lg border border-border/70 bg-card/95 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
			<div className="flex items-start gap-3">
				<MemberAvatar
					memberName={record.memberName}
					image={record.image}
					className="h-11 w-11 border border-border/70"
				/>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-foreground">
						{toTitleCase(record.memberName)}
					</p>
					<div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
						<Clock3Icon className="h-3.5 w-3.5" />
						<span>{format(record.checkInTime, "h:mm:ss a")}</span>
					</div>
				</div>
			</div>
		</article>
	);
}

function groupAttendanceByDay(records: Array<AttendanceTimelineRecord>) {
	const dayGroups = new Map<
		string,
		{
			date: Date;
			records: Array<AttendanceTimelineRecord>;
		}
	>();

	for (const record of records) {
		const dayKey = format(record.checkInTime, "yyyy-MM-dd");

		if (!dayGroups.has(dayKey)) {
			dayGroups.set(dayKey, {
				date: record.checkInTime,
				records: [],
			});
		}

		const group = dayGroups.get(dayKey);
		if (!group) {
			continue;
		}

		group.records.push(record);
	}

	return Array.from(dayGroups.entries()).map(([key, group]) => ({
		key,
		label: isToday(group.date) ? "Today" : format(group.date, "EEEE"),
		dateLabel: format(group.date, "dd MMMM yyyy"),
		records: group.records.sort(
			(a, b) => b.checkInTime.getTime() - a.checkInTime.getTime(),
		),
	}));
}

function formatRangeLabel(from: string, to: string) {
	const start = new Date(`${from}T00:00:00`);
	const end = new Date(`${to}T00:00:00`);

	if (from === to) {
		return isToday(start)
			? `Today, ${format(start, "dd MMM yyyy")}`
			: format(start, "dd MMM yyyy");
	}

	return `${format(start, "dd MMM yyyy")} - ${format(end, "dd MMM yyyy")}`;
}
