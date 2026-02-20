import { createFileRoute } from "@tanstack/react-router";
import { addYears, format, isToday } from "date-fns";
import { and, inArray, lte, notInArray, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { bills, financialYears, forms, vwInvoices } from "@/drizzle/schema";
import { getCurrentFinancialYear } from "@/features/financial-years/services/financial-years.api";
import { normalizeDateRange } from "@/lib/helpers";
import { deleteOlderLogs } from "@/services/activity-logger";

async function autoCreateFinancialYear() {
	const settings = await db.query.settings.findFirst({
		columns: { billing: true },
	});

	if (!settings?.billing?.autoCreateFinancialYear) return;
	const currentFinancialYear = await getCurrentFinancialYear();
	if (!currentFinancialYear) return;

	if (isToday(new Date(currentFinancialYear.endDate))) {
		const newStartDate = addYears(new Date(currentFinancialYear.startDate), 1);
		const newEndDate = addYears(new Date(currentFinancialYear.endDate), 1);

		const { from, to } = normalizeDateRange(newStartDate, newEndDate);

		await db.insert(financialYears).values({
			name: `FY ${format(newStartDate, "yyyy")}`,
			startDate: from,
			endDate: to,
			closed: false,
		});
	}
}

async function runDailyMaintenance() {
	await db.insert(forms).values({
		menuOrder: 1,
		moduleId: 1,
		module: "test",
		name: "test form",
		path: "/",
		resource: "test",
		active: true,
	});

	// 1) delete older audit logs
	await deleteOlderLogs();

	// 2) change status of invoices
	const overDueInvoices = await db
		.select({ id: vwInvoices.id })
		.from(vwInvoices)
		.where(
			and(
				sql`${vwInvoices.balance} > 0`,
				lte(vwInvoices.dueDate, sql`CURRENT_DATE`),
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

	// 3) auto create financial year
	await autoCreateFinancialYear();
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
