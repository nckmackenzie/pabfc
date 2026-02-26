import crypto from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	memberRegistrationLinks,
	members,
	type SMSBroadcastResponse,
	smsBroadcasts,
} from "@/drizzle/schema";
import { replaceVariables } from "@/features/communication/lib/utils";
import { internationalizePhoneNumber } from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";
import { sendSms } from "@/lib/sms";
import { toTitleCase } from "@/lib/utils";

export const sendSmsBroadcast = inngest.createFunction(
	{
		id: "send-sms-broadcast",
	},
	{ event: "app/communications.send-sms-broadcast" },
	async ({ event, step }) => {
		const { broadcastId } = event.data;

		const broadcastDetails = await step.run("get-receipients", async () => {
			const broadcast = await db.query.smsBroadcasts.findFirst({
				columns: { receipients: true, content: true },
				where: eq(smsBroadcasts.id, broadcastId),
			});
			if (!broadcast) {
				throw new Error("Broadcast not found");
			}
			return broadcast;
		});

		const sendSmsStep = await step.run("send-sms", async () => {
			const broadcastResponse: Array<
				SMSBroadcastResponse["SMSMessageData"]["Recipients"][number]
			> = [];
			const { receipients, content } = broadcastDetails;
			for (const receipient of receipients) {
				const [{ firstName, lastName, contact }] = await db
					.select({
						firstName: members.firstName,
						lastName: members.lastName,
						contact: members.contact,
					})
					.from(members)
					.where(eq(members.id, receipient));
				if (!contact) {
					continue;
				}

				const memberDataRecord: Record<string, string | number> = {
					firstName: toTitleCase(firstName.toLowerCase()),
					lastName: toTitleCase(lastName.toLowerCase()),
				};

				const message = replaceVariables(content, memberDataRecord);

				const res = await sendSms({
					message,
					to: [internationalizePhoneNumber(contact, true)],
				});
				if (res) {
					broadcastResponse.push(res.SMSMessageData.Recipients[0]);
				}
			}
			return broadcastResponse;
		});

		await step.run("update-broadcast", async () => {
			await db
				.update(smsBroadcasts)
				.set({
					smsBroadcastStatus: "sent",
					response: sendSmsStep,
				})
				.where(eq(smsBroadcasts.id, broadcastId));
		});
	},
);

export const sendTestSmsToUser = inngest.createFunction(
	{ id: "send-sms-test-to-user" },
	{ event: "app/communications.send-test-to-user" },
	async ({ event }) => {
		const { content, contact } = event.data;
		const res = await sendSms({ message: content, to: contact });
		return res;
	},
);

export const sendRegistrationLink = inngest.createFunction(
	{ id: "send-member-registration-link" },
	{ event: "app/members.send.registration.link" },
	async ({ event, step }) => {
		const { memberId } = event.data;
		const member = await db.query.members.findFirst({
			columns: { contact: true, firstName: true },
			where: eq(members.id, memberId),
		});

		if (!member) {
			throw new Error("Member not found");
		}

		const registrationLink = await step.run(
			"generate-registration-link",
			async () => {
				const existingLink = await db.query.memberRegistrationLinks.findFirst({
					columns: { shortCode: true },
					where: and(
						eq(memberRegistrationLinks.memberId, memberId),
						isNull(memberRegistrationLinks.usedAt),
					),
				});

				if (existingLink) {
					return `${process.env.MEMBER_PORTAL_URL as string}/register/${existingLink.shortCode}`;
				}

				const shortCode = crypto.randomBytes(4).toString("hex").substring(0, 6);

				await db.insert(memberRegistrationLinks).values({
					memberId,
					shortCode,
				});

				return `${process.env.MEMBER_PORTAL_URL as string}/register/${shortCode}`;
			},
		);

		await step.run("send-registration-link", async () => {
			const res = await sendSms({
				message: `Dear ${toTitleCase(member.firstName)}, welcome to PABFC💪🏿! Click the link provided to complete your registration and create your account: ${registrationLink}`,
				to: [internationalizePhoneNumber(member.contact as string, true)],
			});
			return res;
		});
	},
);
