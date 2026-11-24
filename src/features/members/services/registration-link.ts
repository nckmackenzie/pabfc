import { inngest } from "@/lib/inngest/client";

// Texts the member a link to finish registration and create their portal
// account. Always call after the member insert has committed.
export function sendRegistrationLinkEvent(memberId: string) {
	return inngest.send({
		name: "app/members.send.registration.link",
		data: {
			memberId,
		},
	});
}
