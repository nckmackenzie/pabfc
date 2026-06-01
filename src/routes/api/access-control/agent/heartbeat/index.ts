import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accessControlAgents } from "@/drizzle/schema";
import { authenticateAccessAgent } from "@/services/access-control";

export const Route = createFileRoute("/api/access-control/agent/heartbeat/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const agent = await authenticateAccessAgent(
					request.headers.get("authorization"),
				);

				if (!agent)
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: {
							"Content-Type": "application/json",
						},
					});

				try {
					await db
						.update(accessControlAgents)
						.set({
							status: "online",
							lastSeenAt: new Date(),
							lastError: null,
							updatedAt: new Date(),
						})
						.where(eq(accessControlAgents.id, agent.id));

					return new Response(
						JSON.stringify({ success: true, agentId: agent.id }),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
							},
						},
					);
				} catch (error) {
					console.error(error);
					return new Response(
						JSON.stringify({ error: "Internal Server Error" }),
						{
							status: 500,
							headers: {
								"Content-Type": "application/json",
							},
						},
					);
				}
			},
		},
	},
});
