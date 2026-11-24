import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { nanoid } from "nanoid";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { isOpenStatus } from "@/features/enquiries/lib/enquiry-status";
import { linkEnquiryToMemberFn } from "@/features/enquiries/services/enquiries.conversion.api";
import type { EnquiryDetail } from "@/features/enquiries/services/enquiries.queries.api";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { memberQueries } from "@/features/members/services/queries";
import { success } from "@/lib/result";

// "Convert to member" for a brand-new person, or "Link to existing member" when
// the phone already belongs to a live member (e.g. a lapsed member asking again).
export function ConvertToMemberActions({ enquiry }: { enquiry: EnquiryDetail }) {
	const queryClient = useQueryClient();
	const open = isOpenStatus(enquiry.status);
	const { data: duplicates, isPending } = useQuery({
		...enquiryQueries.duplicates(enquiry.phone, enquiry.id),
		enabled: open,
	});

	if (!open) return null;

	const existingMember = duplicates?.member;

	return (
		<PermissionGate permission="enquiries:convert">
			{isPending ? (
				<Button variant="outline" disabled>
					Checking members...
				</Button>
			) : existingMember?.deleted ? (
				<p className="text-sm text-muted-foreground">
					This number belongs to a deleted member ({existingMember.name}, no.{" "}
					{existingMember.memberNo}), so it can't be converted.
				</p>
			) : existingMember ? (
				<ActionButton
					variant="outline"
					requireAreYouSure
					isDestructive={false}
					areYouSureDescription={
						<>
							Link this enquiry to{" "}
							<strong>
								{existingMember.name} (member no. {existingMember.memberNo})
							</strong>
							? It will be marked registered and converts on their next completed payment.
						</>
					}
					action={async () => {
						const result = await linkEnquiryToMemberFn({
							data: { enquiryId: enquiry.id, memberId: existingMember.id },
						});
						if (!result.success) return result;
						await Promise.all([
							queryClient.invalidateQueries({ queryKey: enquiryQueries.all }),
							queryClient.invalidateQueries({ queryKey: memberQueries.all }),
						]);
						return success(undefined);
					}}
				>
					Link to existing member
				</ActionButton>
			) : (
				<PermissionGate permission="members:create">
					<Button asChild>
						<Link to="/app/enquiries/$enquiryId/convert" params={{ enquiryId: enquiry.id }}>
							Convert to member
						</Link>
					</Button>
				</PermissionGate>
			)}
		</PermissionGate>
	);
}

// Where a registered or converted enquiry points: its member and its payment.
export function ConversionLinks({ enquiry }: { enquiry: EnquiryDetail }) {
	return (
		<>
			{enquiry.convertedMemberId && (
				<div className="space-y-1">
					<dt className="text-sm text-muted-foreground">Member</dt>
					<dd className="text-sm font-medium">
						<PermissionGate
							permission="members:view-profile"
							fallback={
								<span>
									{enquiry.convertedMemberName} (no. {enquiry.convertedMemberNo})
								</span>
							}
						>
							<Link
								to="/app/members/$memberId/profile"
								params={{ memberId: enquiry.convertedMemberId }}
								search={{ vid: nanoid() }}
								className="underline"
							>
								{enquiry.convertedMemberName} (no. {enquiry.convertedMemberNo})
							</Link>
						</PermissionGate>
					</dd>
				</div>
			)}
			{enquiry.status === "registered" && enquiry.convertedMemberId && (
				<div className="space-y-1">
					<dt className="text-sm text-muted-foreground">Payment</dt>
					<dd className="flex flex-wrap items-center gap-2 text-sm font-medium">
						<Badge variant="warning">Awaiting first payment</Badge>
						<PermissionGate permission="receipts:create">
							<Link
								to="/app/receipts/new"
								search={{ memberId: enquiry.convertedMemberId }}
								className="underline"
							>
								Record payment
							</Link>
						</PermissionGate>
					</dd>
				</div>
			)}
			{enquiry.convertedPaymentId && (
				<div className="space-y-1">
					<dt className="text-sm text-muted-foreground">Payment</dt>
					<dd className="text-sm font-medium">
						<Link
							to="/app/receipts/$receiptId/details"
							params={{ receiptId: enquiry.convertedPaymentId }}
							className="underline"
						>
							Receipt {enquiry.convertedPaymentNo}
						</Link>
					</dd>
				</div>
			)}
		</>
	);
}
