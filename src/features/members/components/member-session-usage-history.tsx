import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	HistoryMessage,
	HistorySection,
	HistorySkeleton,
} from "@/features/members/components/member-profile-history";
import { memberQueries } from "@/features/members/services/queries";
import { dateFormat } from "@/lib/helpers";

export function MemberSessionUsageHistory({ memberId }: { memberId: string }) {
	const { data, isLoading, isError } = useQuery(memberQueries.sessionUsageHistory(memberId));

	return (
		<HistorySection title="Session Usage History">
			{isLoading ? (
				<HistorySkeleton />
			) : isError ? (
				<HistoryMessage
					icon={<CalendarCheck2Icon className="size-12" />}
					message="Unable to load session usage history."
				/>
			) : !data?.length ? (
				<HistoryMessage
					icon={<CalendarCheck2Icon className="size-12" />}
					message="No session usage recorded yet."
				/>
			) : (
				<ul className="divide-y">
					{data.map((usage) => (
						<li key={usage.id} className="flex items-center justify-between gap-4 py-2">
							<div className="grid gap-0.5">
								<span className="text-sm font-medium">{dateFormat(usage.usageDate, "long")}</span>
								<span className="text-xs text-muted-foreground">
									{usage.source === "manual" ? "Manual" : "Punch"}
									{usage.reason ? ` — ${usage.reason}` : ""}
									{usage.voidedAt && usage.voidReason ? ` · Waived: ${usage.voidReason}` : ""}
									{usage.createdByUser?.name ? ` · Recorded by ${usage.createdByUser.name}` : ""}
									{usage.voidedByUser?.name ? ` · Waived by ${usage.voidedByUser.name}` : ""}
								</span>
							</div>
							<Badge variant={usage.voidedAt ? "secondary" : "success"}>
								{usage.voidedAt ? "Waived" : "Counted"}
							</Badge>
						</li>
					))}
				</ul>
			)}
		</HistorySection>
	);
}
