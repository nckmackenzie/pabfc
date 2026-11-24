import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { PhoneIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { cn } from "@/lib/utils";

function Stat({
	label,
	value,
	tone = "default",
}: {
	label: string;
	value: number;
	tone?: "default" | "danger";
}) {
	return (
		<div className="rounded-md border p-3">
			<p
				className={cn("text-2xl font-semibold font-mono", {
					"text-destructive": tone === "danger" && value > 0,
				})}
			>
				{value}
			</p>
			<p className="text-xs text-muted-foreground">{label}</p>
		</div>
	);
}

export function EnquiriesSnapshot() {
	const { data } = useSuspenseQuery(enquiryQueries.dashboardSnapshot());

	return (
		<Card className="h-full shadow-none">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle>Enquiries</CardTitle>
					<Link to="/app/enquiries" className="text-xs underline text-muted-foreground">
						View all
					</Link>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-2">
					<Stat label="New this week" value={data.newThisWeek} />
					<Stat label="Converted this month" value={data.conversionsThisMonth} />
					<Stat label="Follow-ups today" value={data.followUpsDueToday} />
					<Stat label="Overdue follow-ups" value={data.followUpsOverdue} tone="danger" />
				</div>

				<div className="space-y-2">
					<p className="text-sm font-medium">Follow-ups to do</p>
					{data.followUps.length === 0 ? (
						<EmptyState
							icon={<PhoneIcon className="h-6 w-6" />}
							title="All caught up"
							description="No follow-ups are due or overdue."
						/>
					) : (
						<ul className="divide-y rounded-md border">
							{data.followUps.map((followUp) => (
								<li key={followUp.id}>
									<Link
										to="/app/enquiries/$enquiryId"
										params={{ enquiryId: followUp.id }}
										className="flex items-center justify-between gap-2 p-2 hover:bg-muted"
									>
										<span className="min-w-0">
											<span className="block truncate text-sm font-medium">{followUp.name}</span>
											<span className="block truncate text-xs text-muted-foreground">
												{followUp.assignedEmployeeName ?? "Unassigned"}
											</span>
										</span>
										<Badge variant={followUp.overdue ? "danger" : "warning"} className="shrink-0">
											{followUp.overdue
												? format(parseISO(followUp.followUpDate), "dd MMM")
												: "Today"}
										</Badge>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export function EnquiriesSnapshotSkeleton() {
	return (
		<Card className="h-full shadow-none">
			<CardHeader className="pb-2">
				<Skeleton className="h-5 w-24" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-2">
					{["a", "b", "c", "d"].map((key) => (
						<Skeleton key={key} className="h-16 w-full" />
					))}
				</div>
				<Skeleton className="h-32 w-full" />
			</CardContent>
		</Card>
	);
}
