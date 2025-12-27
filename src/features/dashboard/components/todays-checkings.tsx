import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	CalendarArrowDownIcon,
	CalendarArrowUpIcon,
	CalendarCheck2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { MemberAvatar } from "@/features/members/components/member-table";
import { cn } from "@/lib/utils";

export function TodaysCheckings() {
	const { data: recentCheckIns } = useSuspenseQuery(
		dashboardQueries.todaysAttendances(),
	);

	return (
		<Card className="h-full shadow-none">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<div className="flex items-center gap-3">
					<CardTitle>Today's Check-ins</CardTitle>
				</div>
				<Badge variant="secondary" className="font-mono">
					{recentCheckIns.length} today
				</Badge>
			</CardHeader>
			<CardContent className="p-0">
				<ScrollArea className="h-[340px]">
					<div className="space-y-1 px-5 pb-5">
						{recentCheckIns.length > 0 ? (
							recentCheckIns.map((checkIn, index) => (
								<DashboardAttendanceItem
									key={checkIn.id}
									checkIn={checkIn}
									index={index}
								/>
							))
						) : (
							<EmptyState
								title="No check-ins"
								description="No check-ins today yet!"
								icon={<CalendarCheck2Icon />}
							/>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}

export function TodaysCheckingsSkeleton() {
	return (
		<Card className="h-full shadow-none">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<div className="flex items-center gap-3">
					<CardTitle>Today's Check-ins</CardTitle>
				</div>
				<Skeleton className="h-5 w-20" />
			</CardHeader>
			<CardContent className="p-0">
				<div className="space-y-1 px-5 pb-5 pt-3">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
							key={i}
							className="flex items-center justify-between rounded-lg p-3"
						>
							<div className="flex items-center gap-3">
								<Skeleton className="h-10 w-10 rounded-full" />
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-48" />
								</div>
							</div>
							<Skeleton className="h-5 w-16" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function DashboardAttendanceItem({
	checkIn,
	index,
}: {
	checkIn: {
		id: bigint | number;
		memberName: string;
		image: string | null;
		checkInTime: Date;
		checkOutTime: Date | null;
		activePlanName: string | null;
		duration: string | null;
	};
	index: number;
}) {
	return (
		<div
			key={checkIn.id}
			className={cn(
				"group flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-secondary/50",
				"animate-fade-in",
			)}
			style={{ animationDelay: `${index * 50}ms` }}
		>
			<div className="flex items-center gap-3">
				<MemberAvatar memberName={checkIn.memberName} image={checkIn.image} />
				<div>
					<p className="text-sm font-medium text-foreground">
						{checkIn.memberName}
					</p>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<div className="flex items-center gap-1">
							<CalendarArrowDownIcon className="h-3 w-3" />
							<span className="text-xs">
								{format(checkIn.checkInTime, "h:mm a")}
							</span>
						</div>
						<span>•</span>
						{checkIn.checkOutTime && (
							<div className="flex items-center gap-1">
								<CalendarArrowUpIcon className="h-3 w-3" />
								<span className="text-xs">
									{format(checkIn.checkOutTime, "h:mm a")}
								</span>
							</div>
						)}
					</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Badge variant={checkIn.checkOutTime ? "info" : "success"}>
					{checkIn.checkOutTime ? checkIn.duration : "In Session"}
				</Badge>
			</div>
		</div>
	);
}
