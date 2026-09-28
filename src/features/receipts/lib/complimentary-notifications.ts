import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	members,
	membershipPlans,
	users,
	type complimentaryMembershipRequests,
} from "@/drizzle/schema";
import { sendSms, smsSchema } from "@/lib/sms";

type ComplimentaryRequestRow = typeof complimentaryMembershipRequests.$inferSelect;

export function selectValidContacts(contacts: Array<string | null | undefined>): string[] {
	return contacts.filter((contact): contact is string => {
		if (!contact) return false;
		return smsSchema.shape.to.element.safeParse(contact).success;
	});
}

export function buildRequestSubmittedMessage({
	memberName,
	planName,
	requesterName,
}: {
	memberName: string;
	planName: string;
	requesterName: string;
}) {
	return `New complimentary membership request for ${memberName} (${planName}) from ${requesterName}. Review in the app.`;
}

export function buildDecisionMessage({
	status,
	rejectionReason,
}: {
	status: "approved" | "rejected";
	rejectionReason?: string | null;
}) {
	if (status === "approved") {
		return "Your complimentary membership request has been approved.";
	}
	return `Your complimentary membership request was rejected.${
		rejectionReason ? ` Reason: ${rejectionReason}` : ""
	}`;
}

async function sendToValidContacts(contacts: Array<string | null | undefined>, message: string) {
	const validNumbers = selectValidContacts(contacts);
	if (validNumbers.length === 0) {
		console.log("Complimentary membership notification skipped: no valid recipient phone numbers.");
		return;
	}
	const parsed = smsSchema.safeParse({ to: validNumbers, message });
	if (!parsed.success) {
		console.log(parsed.error);
		return;
	}
	// sendSms already swallows its own errors and logs internally — no try/catch needed here.
	await sendSms(parsed.data);
}

// Best-effort, called after the submitting transaction has committed — never
// throws, never affects the caller's Result.
export async function notifyComplimentaryRequestSubmitted(request: ComplimentaryRequestRow) {
	const [member, plan, requester, recipients] = await Promise.all([
		db.query.members.findFirst({
			where: eq(members.id, request.memberId),
			columns: { firstName: true, lastName: true },
		}),
		db.query.membershipPlans.findFirst({
			where: eq(membershipPlans.id, request.planId),
			columns: { name: true },
		}),
		db.query.users.findFirst({
			where: eq(users.id, request.requestedByUserId),
			columns: { name: true },
		}),
		db.query.users.findMany({
			where: (usersTable, { and, eq: eqOp }) =>
				and(
					eqOp(usersTable.role, "admin"),
					eqOp(usersTable.active, true),
					eqOp(usersTable.isSystemAdmin, false)
				),
			columns: { contact: true },
		}),
	]);

	const message = buildRequestSubmittedMessage({
		memberName: member ? `${member.firstName} ${member.lastName}` : "a member",
		planName: plan?.name ?? "a plan",
		requesterName: requester?.name ?? "a staff member",
	});

	await sendToValidContacts(
		recipients.map((recipient) => recipient.contact),
		message
	);
}

// Best-effort, called after the approving/rejecting transaction has committed.
export async function notifyComplimentaryRequestDecision(request: ComplimentaryRequestRow) {
	const requester = await db.query.users.findFirst({
		where: eq(users.id, request.requestedByUserId),
		columns: { contact: true },
	});
	const message = buildDecisionMessage({
		status: request.status as "approved" | "rejected",
		rejectionReason: request.rejectionReason,
	});
	await sendToValidContacts([requester?.contact], message);
}
