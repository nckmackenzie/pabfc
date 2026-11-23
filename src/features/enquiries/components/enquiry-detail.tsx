import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { EnquiryStatusBadge } from "@/features/enquiries/components/enquiry-status-badge";
import { FollowUpDate } from "@/features/enquiries/components/follow-up-date";
import { useEnquiryActions } from "@/features/enquiries/hooks/use-enquiry-actions";
import { enquiryLostReasonLabel, enquirySourceLabel } from "@/features/enquiries/lib/constants";
import { allowedManualTransitions } from "@/features/enquiries/lib/enquiry-status";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import type { EnquiryDetail as EnquiryDetailData } from "@/features/enquiries/services/enquiries.queries.api";

// PART 2 SLOT: "Convert to member" action (permission: enquiries:convert).
// Intentionally renders nothing until the conversion flow exists.
function ConvertToMemberSlot(_props: { enquiry: EnquiryDetailData }): ReactNode {
	return null;
}

// PART 3 SLOT: "Send SMS" action (permission: enquiries:send-sms; needs smsConsent).
// Intentionally renders nothing until manual SMS to enquirers exists.
function SendSmsSlot(_props: { enquiry: EnquiryDetailData }): ReactNode {
	return null;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-1">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium wrap-break-word">{children}</dd>
		</div>
	);
}

const dash = <span className="text-muted-foreground">-</span>;

export function EnquiryDetail({ enquiry }: { enquiry: EnquiryDetailData }) {
	const { handleMarkContacted, handleMarkLost, handleReopen } = useEnquiryActions();
	const name = enquiryFullName(enquiry.firstName, enquiry.lastName);
	const next = allowedManualTransitions(enquiry.status);

	return (
		<>
			<PageHeader
				title={name}
				description={`Enquiry logged ${format(new Date(enquiry.createdAt), "dd MMM yyyy")}`}
				content={<EnquiryStatusBadge status={enquiry.status} />}
			/>

			<div className="flex flex-wrap items-center gap-2">
				<PermissionGate permission="enquiries:update">
					<Button variant="outline" asChild>
						<Link to="/app/enquiries/$enquiryId/edit" params={{ enquiryId: enquiry.id }}>
							Edit
						</Link>
					</Button>
					{enquiry.status === "new" && next.includes("contacted") && (
						<Button variant="outline" onClick={() => handleMarkContacted(enquiry.id)}>
							Mark contacted
						</Button>
					)}
					{enquiry.status === "lost" && (
						<Button variant="outline" onClick={() => handleReopen(enquiry.id)}>
							Reopen
						</Button>
					)}
					{next.includes("lost") && (
						<Button
							variant="outline"
							onClick={() => handleMarkLost({ enquiryId: enquiry.id, enquiryName: name })}
						>
							Mark lost
						</Button>
					)}
				</PermissionGate>
				<ConvertToMemberSlot enquiry={enquiry} />
				<SendSmsSlot enquiry={enquiry} />
			</div>

			<dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
				<DetailItem label="Phone">{enquiry.phone}</DetailItem>
				<DetailItem label="Email">{enquiry.email ?? dash}</DetailItem>
				<DetailItem label="Source">
					{enquirySourceLabel(enquiry.source)}
					{enquiry.sourceNotes ? ` (${enquiry.sourceNotes})` : ""}
				</DetailItem>
				<DetailItem label="Interested Plan">{enquiry.interestedPlanName ?? dash}</DetailItem>
				<DetailItem label="Assigned Staff">{enquiry.assignedEmployeeName ?? dash}</DetailItem>
				<DetailItem label="Follow-up">
					<FollowUpDate followUpDate={enquiry.followUpDate} status={enquiry.status} />
				</DetailItem>
				<DetailItem label="SMS Consent">
					{enquiry.smsConsent ? (
						<span>
							<Badge variant="success">Agreed</Badge>
							{enquiry.smsConsentAt && (
								<span className="ml-2 text-muted-foreground">
									{format(new Date(enquiry.smsConsentAt), "dd MMM yyyy")}
								</span>
							)}
						</span>
					) : (
						<Badge variant="secondary">Not given</Badge>
					)}
				</DetailItem>
				{enquiry.status === "lost" && (
					<DetailItem label="Lost Reason">
						{enquiryLostReasonLabel(enquiry.lostReason) || dash}
						{enquiry.lostReasonNotes ? ` - ${enquiry.lostReasonNotes}` : ""}
					</DetailItem>
				)}
				{enquiry.registeredAt && (
					<DetailItem label="Registered">
						{format(new Date(enquiry.registeredAt), "dd MMM yyyy")}
					</DetailItem>
				)}
				{enquiry.convertedAt && (
					<DetailItem label="Converted">
						{format(new Date(enquiry.convertedAt), "dd MMM yyyy")}
					</DetailItem>
				)}
				<div className="sm:col-span-2 lg:col-span-3">
					<DetailItem label="Notes">
						{enquiry.notes ? <p className="whitespace-pre-wrap">{enquiry.notes}</p> : dash}
					</DetailItem>
				</div>
			</dl>
		</>
	);
}
