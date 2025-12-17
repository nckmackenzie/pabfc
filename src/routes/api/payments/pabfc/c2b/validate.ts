import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/payments/pabfc/c2b/validate")({
	server: {
		handlers: {
			POST: async () => {
				const responseBody = {
					ResultCode: 0,
					ResultDesc: "Received successfully",
				};

				return new Response(JSON.stringify(responseBody), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
