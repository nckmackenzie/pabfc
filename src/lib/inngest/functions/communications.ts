import { inngest } from "@/lib/inngest/client";
import { sendSms } from "@/lib/sms";

export const sendSmsBroadcast = inngest.createFunction(
	{
		id: "send-sms-broadcast",
	},
	{ event: "app/communications.send-sms-broadcast" },
	async ({ event }) => {
		const { broadcastId } = event.data;
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
