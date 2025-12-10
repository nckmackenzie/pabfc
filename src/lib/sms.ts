import { createServerFn } from "@tanstack/react-start";
import africastalking from "africastalking";
import { z } from "zod";
import { authMiddleware } from "@/middlewares/auth-middleware";

const credentials = {
	apiKey: process.env.SMS_API_KEY as string, // use your sandbox app API key for development in the test environment
	username: process.env.SMS_USERNAME as string, // use 'sandbox' for development in the test environment
};

const AfricasTalking = africastalking(credentials);

const sms = AfricasTalking.SMS;

export const smsSchema = z.object({
	to: z.array(
		z.string().regex(/\+254\d{9}/, { error: "Invalid phone number" }),
	),
	message: z.string(),
});

export const sendSms = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(smsSchema)
	.handler(async ({ data: { to, message } }) => {
		const options = {
			to,
			message,
			from: "PANESAR",
		};

		try {
			const response = await sms.send(options);
			return response;
		} catch (error) {
			console.log(error);
		}
	});
