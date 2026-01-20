import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
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
