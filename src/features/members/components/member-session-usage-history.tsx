import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { AddSessionUsageModal } from "@/features/session-usage/components/add-session-usage-modal";
import { WaiveSessionUsageModal } from "@/features/session-usage/components/waive-session-usage-modal";
import {
	HistoryMessage,
	HistorySection,
	HistorySkeleton,
} from "@/features/members/components/member-profile-history";
import { memberQueries } from "@/features/members/services/queries";
import { useModal } from "@/integrations/modal-provider";
import { dateFormat } from "@/lib/helpers";

export function MemberSessionUsageHistory({ memberId }: { memberId: string }) {
	const { setOpen } = useModal();
	const { data, isLoading, isError } = useQuery(memberQueries.sessionUsageHistory(memberId));
	const { data: profile } = useQuery(memberQueries.overview(memberId));
	const sessionInfo = profile?.sessionInfo ?? null;

	return (
		<HistorySection
			title="Session Usage History"
			action={
				sessionInfo && (
					<PermissionGate permission="attendance:adjust-sessions">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								setOpen(
									<AddSessionUsageModal
										memberId={memberId}
										membershipId={sessionInfo.membershipId}
										minDate={sessionInfo.startDate}
										maxDate={sessionInfo.originalEndDate ?? sessionInfo.endDate ?? sessionInfo.startDate}
									/>
								)
							}
						>
							Add session
						</Button>
					</PermissionGate>
				)
			}
		>
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
							<div className="flex items-center gap-2">
								<Badge variant={usage.voidedAt ? "secondary" : "success"}>
									{usage.voidedAt ? "Waived" : "Counted"}
								</Badge>
								{!usage.voidedAt && (
									<PermissionGate permission="attendance:adjust-sessions">
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setOpen(<WaiveSessionUsageModal memberId={memberId} usageId={usage.id} />)
											}
										>
											Waive
										</Button>
									</PermissionGate>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</HistorySection>
	);
}
