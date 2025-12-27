import { useSuspenseQuery } from "@tanstack/react-query";
import {
	CalendarClockIcon,
	Clock11Icon,
	DoorOpenIcon,
	type LucideIcon,
	Users2Icon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { percentageChangeCalculator } from "@/lib/helpers";
import { cn } from "@/lib/utils";
export function StatCards() {
	const {
		data: {
			activeMembers,
			newMembersThisMonth,
			expiringMemberships,
			totalAttendance,
			averageAttendanceDuration,
			newMembersLastMonth,
		},
	} = useSuspenseQuery(dashboardQueries.stats());

	return (
		<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<KPICard
				title="Active Members"
				value={activeMembers.toLocaleString()}
				subtitle={` ${newMembersThisMonth === 0 ? "No new members this month" : newMembersThisMonth === 1 ? "1 new member this month" : `${newMembersThisMonth} new members this month`}`}
				icon={Users2Icon}
				trend={percentageChangeCalculator(
					newMembersThisMonth,
					newMembersLastMonth,
				)}
				variant="default"
			/>
			<KPICard
				title="Expiring Soon"
				value={expiringMemberships}
				subtitle={
					expiringMemberships === 0
						? "No expiring memberships"
						: expiringMemberships === 1
							? "1 expiring membership"
							: `${expiringMemberships} expiring memberships`
				}
				icon={CalendarClockIcon}
				variant="default"
			/>
			<KPICard
				title="Check-ins"
				value={totalAttendance}
				subtitle={`${averageAttendanceDuration} average session duration`}
				icon={DoorOpenIcon}
				variant="default"
			/>
			<KPICard
				title="Duration"
				value={averageAttendanceDuration}
				subtitle={`Average attendance duration`}
				icon={Clock11Icon}
				variant="default"
			/>
		</div>
	);
}

export function StatCardsSkeleton() {
	return (
		<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 4 }).map((_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
					key={i}
					className="relative overflow-hidden rounded-xl border p-5"
				>
					<div className="flex items-start justify-between">
						<div className="space-y-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-16" />
							<Skeleton className="h-3 w-32" />
						</div>
						<Skeleton className="h-10 w-10 rounded-lg" />
					</div>
				</div>
			))}
		</div>
	);
}

interface KPICardProps {
	title: string;
	value: string | number;
	subtitle?: string;
	icon: LucideIcon;
	trend?: {
		value: number;
		isPositive: boolean;
	};
	variant?: "default" | "success" | "warning" | "destructive";
	className?: string;
}

export function KPICard({
	title,
	value,
	subtitle,
	icon: Icon,
	trend,
	variant = "default",
	className,
}: KPICardProps) {
	const variantStyles = {
		default: "from-primary/10 to-primary/5 border-primary/20",
		success: "from-success/10 to-success/5 border-success/20",
		warning: "from-warning/10 to-warning/5 border-warning/20",
		destructive: "from-destructive/10 to-destructive/5 border-destructive/20",
	};

	const iconStyles = {
		default: "bg-primary/20 text-primary",
		success: "bg-success/20 text-success",
		warning: "bg-warning/20 text-warning",
		destructive: "bg-destructive/20 text-destructive",
	};

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
				variantStyles[variant],
				className,
			)}
		>
			<div className="flex items-start justify-between">
				<div className="space-y-2">
					<p className="text-sm font-medium text-muted-foreground">{title}</p>
					<p className="text-3xl font-bold tracking-tight text-foreground">
						{value}
					</p>
					{subtitle && (
						<p className="text-xs text-muted-foreground">{subtitle}</p>
					)}
					{trend && (
						<div className="flex items-center gap-1 text-xs">
							<span
								className={cn(
									"font-medium",
									trend.isPositive ? "text-emerald-500" : "text-destructive",
								)}
							>
								{trend.isPositive ? "+" : "-"}
								{Math.abs(trend.value)}%
							</span>
							<span className="text-muted-foreground">vs last month</span>
						</div>
					)}
				</div>
				<div className={cn("rounded-lg p-2.5", iconStyles[variant])}>
					<Icon className="h-5 w-5" />
				</div>
			</div>
		</div>
	);
}
