import { format } from "date-fns";
import { z } from "zod";

const baseUrl =
	process.env.MPESA_ENV === "sandbox"
		? "https://sandbox.safaricom.co.ke"
		: "https://api.safaricom.co.ke";

export const stkPushSchema = z.object({
	amount: z.number(),
	phoneNumber: z.string().regex(/254\d{9}/, { error: "Invalid phone number" }),
	accountReference: z.string().optional(),
	transactionDesc: z.string().optional(),
});

export type StkPushParams = z.infer<typeof stkPushSchema>;

export function generatePassword(timestamp: string) {
	const { MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;
	if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
		throw new Error("MPESA_SHORTCODE or MPESA_PASSKEY missing");
	}
	const dataToEncode = `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`;
	return Buffer.from(dataToEncode).toString("base64");
}

export async function getAccessToken() {
	const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;
	if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
		throw new Error("MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET missing");
	}

	const url = `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
	const auth = Buffer.from(
		`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`,
	).toString("base64");

	const res = await fetch(url, {
		headers: {
			Authorization: `Basic ${auth}`,
		},
	});

	if (!res.ok) {
		const text = await res.text();
		console.error("M-Pesa token error:", text);
		throw new Error("Failed to get M-Pesa access token");
	}

	const json = (await res.json()) as { access_token: string };
	return json.access_token;
}

export async function initiateMpesaStkPush(params: StkPushParams) {
	const { MPESA_SHORTCODE, MPESA_CALLBACK_DOMAIN } = process.env;

	if (!MPESA_SHORTCODE || !MPESA_CALLBACK_DOMAIN) {
		throw new Error("MPESA_SHORTCODE or MPESA_CALLBACK_DOMAIN missing");
	}

	const { amount, phoneNumber, accountReference, transactionDesc } = params;

	const timestamp = format(new Date(), "yyyyMMddHHmmss");
	const password = generatePassword(timestamp);
	const accessToken = await getAccessToken();

	const payload = {
		BusinessShortCode: MPESA_SHORTCODE,
		Password: password,
		Timestamp: timestamp,
		TransactionType: "CustomerPayBillOnline",
		Amount: amount,
		PartyA: phoneNumber,
		PartyB: MPESA_SHORTCODE,
		PhoneNumber: phoneNumber,
		CallBackURL: `${MPESA_CALLBACK_DOMAIN}/api/payments/pabfc/stk/callback`,
		AccountReference: accountReference ?? "DefaultRef",
		TransactionDesc: transactionDesc ?? "Payment",
	};

	const url = `${baseUrl}/mpesa/stkpush/v1/processrequest`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const json = await res.json();
	if (!res.ok || json.ResponseCode !== "0") {
		console.error("M-Pesa STK error:", json);
		throw new Error(
			`STK push failed: ${json.errorMessage ?? json.ResponseDescription}`,
		);
	}

	return json as {
		MerchantRequestID: string;
		CheckoutRequestID: string;
		ResponseCode: string;
		CustomerMessage: string;
		ResponseDescription: string;
	};
}

export async function registerUrlCallacks() {
	const { MPESA_SHORTCODE, MPESA_CONFIRMATION_URL, MPESA_VALIDATION_URL } =
		process.env;
	if (!MPESA_SHORTCODE || !MPESA_CONFIRMATION_URL || !MPESA_VALIDATION_URL)
		throw new Error(
			"MPESA_SHORTCODE or MPESA_CONFIRMATION_URL or MPESA_VALIDATION_URL is not set",
		);

	const accessToken = await getAccessToken();

	const payload = {
		ShortCode: MPESA_SHORTCODE,
		ResponseType: "Completed",
		ConfirmationURL: MPESA_CONFIRMATION_URL,
		ValidationURL: MPESA_VALIDATION_URL,
	};

	const res = await fetch(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const json = await res.json();
	if (!res.ok) {
		console.error("C2B register error:", json);
		throw new Error("C2B register failed");
	}

	return json;
}
