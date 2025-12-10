import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { mpesaStkRequests } from "@/drizzle/schema";

export const Route = createFileRoute("/api/mpesa/callback")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await request.json();

				console.log("M-Pesa callback:", JSON.stringify(body, null, 2));

				const stkCallback = body?.Body?.stkCallback;
				const resultCode: number | undefined = stkCallback?.ResultCode;
				const checkoutRequestId: string | undefined =
					stkCallback?.CheckoutRequestID;

				if (checkoutRequestId) {
					const status = resultCode === 0 ? "success" : "failed";
					await db
						.update(mpesaStkRequests)
						.set({
							status,
							callbackPayload: stkCallback ?? null,
						})
						.where(eq(mpesaStkRequests.checkoutRequestId, checkoutRequestId));
				}

				return new Response(JSON.stringify({ status: "ok, we did it" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
