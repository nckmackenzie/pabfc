import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/payments/pabfc-c2b/conf")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await request.json();

				console.log("C2B CONFIRMATION PAYLOAD:", body);

				// await createC2BTransaction(body);

				const responseBody = {
					ResultCode: 0,
					ResultDesc: "Received successfully",
				}

				return new Response(JSON.stringify(responseBody), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				})
			},
		},
	},
});
