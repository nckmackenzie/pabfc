import { createFileRoute } from "@tanstack/react-router";
import { asc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { type MemberStatus, membersOverview } from "@/drizzle/schema";
import type { BroadcastFormSchema } from "@/features/communication/services/schemas";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/api/communications/get-members")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const searchParams = new URL(request.url).searchParams;
				const filterCriteria = searchParams.get("filterCriteria") as
					| BroadcastFormSchema["filterCriteria"]
					| null;
				const criteria = searchParams.get("criteria");
				let members: Array<{ id: string; name: string }> = [];

				if (!filterCriteria) {
					return new Response("Missing filter criteria", {
						status: 400,
					});
				}
				if (filterCriteria === "by status") {
					if (!criteria) {
						return new Response("Missing criteria", {
							status: 400,
						});
					}
					members = await db
						.select({
							id: membersOverview.id,
							name: membersOverview.fullName,
						})
						.from(membersOverview)
						.where(eq(membersOverview.memberStatus, criteria as MemberStatus))
						.orderBy(asc(membersOverview.fullName));
				}
				if (filterCriteria === "all members") {
					members = await db
						.select({
							id: membersOverview.id,
							name: membersOverview.fullName,
						})
						.from(membersOverview)
						.orderBy(asc(membersOverview.fullName));
				}
				if (filterCriteria === "by plan") {
					if (!criteria) {
						return new Response("Missing criteria", {
							status: 400,
						});
					}
					members = await db
						.select({
							id: membersOverview.id,
							name: membersOverview.fullName,
						})
						.from(membersOverview)
						.where(eq(membersOverview.activePlanId, criteria))
						.orderBy(asc(membersOverview.fullName));
				}

				return new Response(
					JSON.stringify(
						members.map(({ id, name }) => ({
							value: id,
							label: toTitleCase(name.toLowerCase()),
						})),
					),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
