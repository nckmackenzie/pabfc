import { createFileRoute } from "@tanstack/react-router";
import { and, inArray, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { bills, vwInvoices } from "@/drizzle/schema";
import { deleteOlderLogs } from "@/services/activity-logger";

async function runDailyMaintenance() {
	// 1) delete older audit logs
	await deleteOlderLogs();

	// 2) change status of invoices
	const overDueInvoices = await db
		.select({ id: vwInvoices.id })
		.from(vwInvoices)
		.where(
			and(
				sql`${vwInvoices.balance} > 0`,
				lt(vwInvoices.dueDate, sql`CURRENT_DATE`),
				notInArray(vwInvoices.status, ["cancelled", "overdue", "draft"]),
			),
		);

	await db
		.update(bills)
		.set({ status: "overdue" })
		.where(
			inArray(
				bills.id,
				overDueInvoices.map((i) => i.id),
			),
		);
}

export const Route = createFileRoute("/api/cron/daily/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const authHeader = request.headers.get("authorization");
				const expected = process.env.CRON_SECRET;

				if (!expected || authHeader !== `Bearer ${expected}`) {
					return new Response("Unauthorized", {
						status: 401,
					});
				}

				await runDailyMaintenance();
				return Response.json({ success: true });
			},
		},
	},
});
