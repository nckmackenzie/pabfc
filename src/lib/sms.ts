import africastalking from "africastalking";
import { z } from "zod";
import type { SMSBroadcastResponse } from "@/drizzle/schema";

const credentials = {
	apiKey: process.env.SMS_API_KEY as string,
	username: process.env.SMS_USERNAME as string,
};

const AfricasTalking = africastalking(credentials);

const sms = AfricasTalking.SMS;

export const smsSchema = z.object({
	to: z.array(
		z.string().regex(/\+254\d{9}/, { error: "Invalid phone number" }),
	),
	message: z.string(),
});

export async function sendSms(data: z.infer<typeof smsSchema>) {
	const options = {
		to: data.to,
		message: data.message,
		from: process.env.SMS_SENDERID as string,
	};

	try {
		const response = await sms.send(options);
		return response as unknown as SMSBroadcastResponse;
	} catch (error) {
		console.log(error);
	}
}
