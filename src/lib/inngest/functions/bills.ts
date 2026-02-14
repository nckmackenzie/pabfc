import { eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { bills, vwInvoices } from "@/drizzle/schema";
import { inngest } from "@/lib/inngest/client";

export const updatePaidInvoiceStatus = inngest.createFunction(
	{ id: "update-paid-invoice-status" },
	{ event: "app/bills.update.invoice.status" },
	async ({ event }) => {
		const { paidInvoiceIds } = event.data;

		if (!paidInvoiceIds.length) return;

		const invoices = await db
			.select({
				id: vwInvoices.id,
				balance: vwInvoices.balance,
			})
			.from(vwInvoices)
			.where(inArray(vwInvoices.id, paidInvoiceIds));

		for (const invoice of invoices) {
			const balance = parseFloat(invoice.balance);
			const status = balance <= 0 ? "paid" : "partially-paid";

			await db.update(bills).set({ status }).where(eq(bills.id, invoice.id));
		}
	},
);
