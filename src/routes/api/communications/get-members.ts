import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/drizzle/db";
import type { MemberStatus } from "@/drizzle/schema";
import type { BroadcastFormSchema } from "@/features/communication/services/schemas";
import type { Option } from "@/types/index.types";

export const Route = createFileRoute("/api/communications/get-members")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const searchParams = new URL(request.url).searchParams;
				const filterCriteria = searchParams.get("filterCriteria") as
					| BroadcastFormSchema["filterCriteria"]
					| null;
				const criteria = searchParams.get("criteria");
				let members: Option[] = [];

				if (!filterCriteria || !criteria) {
					return new Response("Missing filter criteria or criteria", {
						status: 400,
					});
				}
				if (filterCriteria === "by status") {
					members = await db.query.members
						.findMany({
							where: (model, { eq }) =>
								eq(model.memberStatus, criteria as MemberStatus),
							columns: {
								id: true,
								firstName: true,
								lastName: true,
							},
						})
						.then((members) =>
							members.map((member) => ({
								value: member.id,
								label: `${member.firstName} ${member.lastName}`,
							})),
						);
				}
				return new Response(JSON.stringify(members), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
