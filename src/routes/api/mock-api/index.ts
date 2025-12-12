import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mock-api/")({
	server: {
		handlers: {
			GET: async () => {
				return new Response("Nothing much to see here.", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
