import { useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { SendIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CalendarIcon } from "@/components/ui/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { dashboardQueries } from "../services/queries";

export function MembershipsExpiringSoon() {
	const { data: expiringMemberships } = useSuspenseQuery(
		dashboardQueries.expiringMemberships(),
	);
	return (
		<Card className="h-full shadow-none">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle>Membership Actions Needed</CardTitle>
					<Badge variant="warning" className="font-mono">
						{expiringMemberships.length} pending
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<ScrollArea className="h-[340px]">
					<div className="space-y-2 px-5 pb-5">
						{expiringMemberships.length > 0 ? (
							expiringMemberships.map((member, index) => (
								<MemberActionItem
									key={member.id}
									member={member}
									index={index}
								/>
							))
						) : (
							<EmptyState
								icon={<CalendarIcon className="h-6 w-6" />}
								title="Memberships Up to date"
								description="All memberships are up to date"
							/>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}

function MemberActionItem({
	member,
	index,
}: {
	member: {
		id: string;
		memberName: string;
		planName: string | null;
		endDate: Date | string | null;
		contact: string | null;
	};
	index: number;
}) {
	return (
		<div
			key={member.id}
			className={cn(
				"rounded-lg border border-border/50 bg-secondary/30 p-4 transition-all hover:border-border hover:bg-secondary/50",
				"animate-slide-up",
			)}
			style={{ animationDelay: `${index * 75}ms` }}
		>
			<div className="mb-3 flex items-start justify-between">
				<div>
					<p className="font-medium text-foreground">{member.memberName}</p>
					<p className="text-xs text-muted-foreground">{member.planName}</p>
				</div>
				{member.endDate && (
					<Badge variant={member.endDate < new Date() ? "danger" : "warning"}>
						{member.endDate >= new Date()
							? `Expiring in ${formatDistanceToNow(member.endDate)}`
							: `Expired ${formatDistanceToNow(member.endDate, { addSuffix: true })}`}
					</Badge>
				)}
			</div>
			<div className="flex gap-2">
				{/* TODO: Add reminder functionality */}
				<Button variant="default" size="sm" className="flex-1">
					<SendIcon className="mr-1 h-3 w-3" />
					Send Reminder
				</Button>
			</div>
		</div>
	);
}

export function MembershipsExpiringSoonSkeleton() {
	return (
		<Card className="h-full shadow-none">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardTitle>Membership Actions Needed</CardTitle>
					<Skeleton className="h-5 w-20" />
				</div>
			</CardHeader>
			<CardContent className="p-0">
				<div className="space-y-2 px-5 pb-5 pt-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
							key={i}
							className="rounded-lg border border-border/50 bg-secondary/30 p-4"
						>
							<div className="mb-3 flex items-start justify-between">
								<div className="space-y-2">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-24" />
								</div>
								<Skeleton className="h-5 w-24" />
							</div>
							<div className="flex gap-2">
								<Skeleton className="h-9 flex-1" />
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
