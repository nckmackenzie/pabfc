import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CustomModal from "@/components/ui/custom-modal";
import { ChatMessageIcon } from "@/components/ui/icons";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SendEnquirySmsModal } from "@/features/enquiries/components/send-enquiry-sms-modal";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import type { EnquiryDetail } from "@/features/enquiries/services/enquiries.queries.api";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { useModal } from "@/integrations/modal-provider";

// Why a send is blocked for this enquirer, or null when it's allowed.
function smsBlockedReason(enquiry: Pick<EnquiryDetail, "status" | "smsConsent">) {
	if (enquiry.status === "converted") {
		return "This person is a member now. Message them through member broadcasts.";
	}
	if (!enquiry.smsConsent) {
		return "This person hasn't agreed to receive SMS. Tick SMS consent on the enquiry first.";
	}
	return null;
}

export function SendEnquirySmsButton({ enquiry }: { enquiry: EnquiryDetail }) {
	const { setOpen } = useModal();
	const blockedReason = smsBlockedReason(enquiry);

	return (
		<PermissionGate permission="enquiries:send-sms">
			{blockedReason ? (
				<Tooltip>
					<TooltipTrigger asChild>
						{/* A disabled button swallows hover, so the tooltip hangs off a wrapper. */}
						<span tabIndex={0}>
							<Button variant="outline" disabled>
								<ChatMessageIcon className="size-4" />
								Send SMS
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>{blockedReason}</TooltipContent>
				</Tooltip>
			) : (
				<Button
					variant="outline"
					onClick={() =>
						setOpen(
							<CustomModal
								title="Send SMS"
								subtitle={`Send a message to ${enquiryFullName(enquiry.firstName, enquiry.lastName)}`}
							>
								<SendEnquirySmsModal target={{ enquiryIds: [enquiry.id] }} />
							</CustomModal>
						)
					}
				>
					<ChatMessageIcon className="size-4" />
					Send SMS
				</Button>
			)}
		</PermissionGate>
	);
}

const MAX_SELECTED_FOR_SMS = 1000;

// List-page button: texts the ticked rows, or the whole filtered list when none are ticked.
export function BulkEnquirySmsButton({
	selectedIds,
	onSent,
}: {
	selectedIds: string[];
	onSent: () => void;
}) {
	const { setOpen } = useModal();
	const { filters } = useFilters(getRouteApi("/app/enquiries/").id);
	const hasSelection = selectedIds.length > 0;

	function handleClick() {
		if (selectedIds.length > MAX_SELECTED_FOR_SMS) {
			toast.error(
				`Select at most ${MAX_SELECTED_FOR_SMS} enquiries, or clear the selection to text the filtered list.`
			);
			return;
		}
		setOpen(
			<CustomModal
				title="Send SMS"
				subtitle={
					hasSelection
						? `Send a message to ${selectedIds.length} selected`
						: "Send a message to the current filtered list"
				}
			>
				<SendEnquirySmsModal
					target={hasSelection ? { enquiryIds: selectedIds } : { filters }}
					onSent={onSent}
				/>
			</CustomModal>
		);
	}

	return (
		<PermissionGate permission="enquiries:send-sms">
			<Button size="lg" variant="outline" onClick={handleClick}>
				<ChatMessageIcon className="size-4" />
				{hasSelection ? `SMS selected (${selectedIds.length})` : "SMS filtered list"}
			</Button>
		</PermissionGate>
	);
}

export function EnquirySmsHistory({ enquiryId }: { enquiryId: string }) {
	const { data, isPending, error } = useQuery(enquiryQueries.smsHistory(enquiryId));

	return (
		<PermissionGate permission="enquiries:send-sms">
			<section className="space-y-3">
				<h2 className="text-lg font-semibold font-display">SMS history</h2>
				{isPending ? (
					<Skeleton className="h-16 w-full" />
				) : error ? (
					<p className="text-sm text-destructive">Couldn't load SMS history.</p>
				) : data.length === 0 ? (
					<p className="text-sm text-muted-foreground">No messages sent yet.</p>
				) : (
					<ul className="divide-y rounded-md border">
						{data.map((message) => (
							<li key={message.id} className="space-y-1 p-3">
								<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<span>
										{message.sentAt ? format(new Date(message.sentAt), "dd MMM yyyy HH:mm") : "-"}
									</span>
									<Badge variant={message.status === "sent" ? "success" : "info"}>
										{message.status}
									</Badge>
									{message.deliveryStatus && (
										<Badge variant="outline">{message.deliveryStatus}</Badge>
									)}
								</div>
								<p className="whitespace-pre-wrap text-sm">{message.content}</p>
							</li>
						))}
					</ul>
				)}
			</section>
		</PermissionGate>
	);
}
