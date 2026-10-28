import { createFileRoute } from "@tanstack/react-router";
import { addYears, format, isToday } from "date-fns";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { financialYears, memberMemberships } from "@/drizzle/schema";
import { findCurrentFinancialYear } from "@/features/financial-years/services/helpers";
import { activateDueMemberships } from "@/features/receipts/services/membership-payment-finalizer";
import { expireCreditNotes } from "@/features/credit-notes/services/credit-note.maintenance";
import { reconcileSessionUsage } from "@/features/session-usage/services/reconcile";
import { dateFormat, normalizeDateRange } from "@/lib/helpers";
import { nairobiToday } from "@/lib/nairobi-time";
import { deleteOlderLogs } from "@/services/activity-logger";
import { reconcileMemberState } from "@/services/member-state";

async function autoCreateFinancialYear() {
	const settings = await db.query.settings.findFirst({
		columns: { billing: true },
	});

	if (!settings?.billing?.autoCreateFinancialYear) return;
	const currentFinancialYear = await findCurrentFinancialYear();
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
	// 1) delete older audit logs
	await deleteOlderLogs();

	// Invoice overdue state is no longer stamped onto bills.status here. It is
	// derived by vw_invoices from the payment lines on every read, so it stays
	// correct between runs instead of lagging up to a day behind.

	// 2) auto create financial year
	await autoCreateFinancialYear();

	// 3) reconcile session-based memberships against yesterday/today's punches
	// (safety net for the upload-endpoint trigger), then expire the ones that
	// ran out of sessions or lapsed unused, using the Nairobi calendar day.
	// Isolated in its own try/catch (mirroring the upload endpoint's pattern)
	// so a transient failure here — a single bad row, a lock timeout — can't
	// abort the rest of this run and silently skip the three unrelated
	// maintenance steps below.
	try {
		await reconcileSessionUsage();
		await expireExhaustedSessionMemberships();
	} catch (error) {
		console.error("Session-usage reconciliation/expiry failed during nightly maintenance", error);
	}

	// 4) update membership status rollovers (pending → active, active → expired)
	await rolloverMemberships();

	// 5) bring every member's status and door access in line with their
	// memberships. Runs after the rollovers above so it sees their final state,
	// and doubles as the backfill for members whose state drifted. Isolated so a
	// failure can't skip the credit note step below.
	try {
		await reconcileMemberState({ logSummary: true });
	} catch (error) {
		console.error("Member state reconciliation failed during nightly maintenance", error);
	}

	// 6) write off expired, unredeemed credit note balances
	await expireCreditNotes();
}

// Activates due pending memberships, then expires lapsed ones. Member status
// and access are not touched here: reconcileMemberState runs afterwards and
// derives both from the resulting memberships, so jobs are queued only once.
async function rolloverMemberships() {
	// One captured instant so activation and expiry agree on the calendar day.
	const now = new Date();
	const today = dateFormat(now);

	await db.transaction(async (tx) => {
		// Activation runs before expiry so a renewal paid ahead of time starts
		// counting as the member's active membership on its start date.
		await activateDueMemberships(tx, now);

		await tx
			.update(memberMemberships)
			.set({
				status: "expired",
				updatedAt: now,
			})
			.where(and(eq(memberMemberships.status, "active"), lt(memberMemberships.endDate, today)));
	});
}

// Session memberships end at whichever comes first: sessions exhausted
// (reconcileSessionUsage already truncated endDate for those) or the date
// window lapsing unused. Both cases are just "endDate < today" once
// reconcileSessionUsage has run — but unlike rolloverMemberships,
// "today" here must be the Nairobi calendar date, not whatever the server's
// local/UTC date happens to be (see Task 16's finding). Runs before the
// generic expiry step so session memberships are correctly dated first; the
// generic step is then a no-op for rows this one already expired. Member status and access follow in reconcileMemberState.
async function expireExhaustedSessionMemberships() {
	const today = nairobiToday();

	await db.transaction(async (tx) => {
		const toExpire = await tx
			.select({ id: memberMemberships.id, memberId: memberMemberships.memberId })
			.from(memberMemberships)
			.where(
				and(
					sql`${memberMemberships.sessionsTotal} is not null`,
					eq(memberMemberships.status, "active"),
					lt(memberMemberships.endDate, today)
				)
			);

		if (toExpire.length === 0) return;

		await tx
			.update(memberMemberships)
			.set({ status: "expired", updatedAt: new Date() })
			.where(inArray(memberMemberships.id, toExpire.map((row) => row.id)));
	});
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
