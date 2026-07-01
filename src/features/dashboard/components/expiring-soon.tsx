import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { formatDistanceToNow, startOfDay } from "date-fns";
import { Loader2, SendIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { CalendarIcon } from "@/components/ui/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sendMembershipReminderFn } from "../services/dashboard.api";
import { dashboardQueries } from "../services/queries";

export function MembershipsExpiringSoon() {
	const { data: expiringMemberships } = useSuspenseQuery(dashboardQueries.expiringMemberships());
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
								<MemberActionItem key={member.id} member={member} index={index} />
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
	// const endDate = member.endDate ? new Date(`${member.endDate}T00:00:00`) : null;
	const endDate = !member.endDate
		? null
		: member.endDate instanceof Date
			? startOfDay(member.endDate)
			: new Date(`${member.endDate}T00:00:00`);
	const isExpired = endDate ? endDate < startOfDay(new Date()) : false;

	const { mutate: sendReminder, isPending } = useMutation({
		mutationFn: () => sendMembershipReminderFn({ data: member.id }),
		onSuccess: () => toast.success("Reminder sent successfully"),
		onError: () => toast.error("Failed to send reminder"),
	});

	return (
		<div
			key={member.id}
			className={cn(
				"rounded-lg border border-border/50 bg-accent p-4 transition-all hover:border-border",
				"animate-slide-up"
			)}
			style={{ animationDelay: `${index * 75}ms` }}
		>
			<div className="mb-3 flex items-start justify-between">
				<div>
					<p className="font-medium text-foreground capitalize">{member.memberName}</p>
					<p className="text-xs text-muted-foreground capitalize">{member.planName}</p>
				</div>
				{endDate && (
					<Badge variant={isExpired ? "danger" : "warning"}>
						{isExpired
							? `Expired ${formatDistanceToNow(endDate, { addSuffix: true })}`
							: `Expiring in ${formatDistanceToNow(endDate)}`}
					</Badge>
				)}
			</div>
			<div className="flex gap-2">
				<Button
					variant="default"
					size="sm"
					className="flex-1"
					disabled={isPending}
					onClick={() => sendReminder()}
				>
					{isPending ? (
						<Loader2 className="mr-1 h-3 w-3 animate-spin" />
					) : (
						<SendIcon className="mr-1 h-3 w-3" />
					)}
					{isPending ? "Sending..." : "Send Reminder"}
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
							className="rounded-lg border border-border/50 p-4"
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
