import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { biotimeAttendanceSyncState } from "@/drizzle/schema";
import { authenticateAccessAgent } from "@/services/access-control";

const SYNC_LOOKBACK_DAYS = 30;

function subtractDays(date: Date, days: number) {
	return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

export const Route = createFileRoute("/api/access-control/agent/attendance-sync/state/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const agent = await authenticateAccessAgent(request.headers.get("authorization"));

				if (!agent)
					return new Response(JSON.stringify({ error: "Unauthorized" }), {
						status: 401,
						headers: {
							"Content-Type": "application/json",
						},
					});

				try {
					const now = new Date();

					let syncState = await db.query.biotimeAttendanceSyncState.findFirst();
					if (!syncState) {
						const [created] = await db
							.insert(biotimeAttendanceSyncState)
							.values({
								lastSuccessfulSyncAt: null,
								lastAttemptedSyncAt: now,
								lastInsertedCount: 0,
								lastSkippedDuplicateCount: 0,
								lastUnmappedCount: 0,
								createdAt: now,
								updatedAt: now,
							})
							.returning();

						syncState = created;
					}

					// Always pull a fixed lookback window from "now" instead of
					// advancing off lastSuccessfulSyncAt. The BioTime PC/device can go
					// offline for stretches and only transmits punches once it
					// reconnects; anchoring the window to the last successful sync
					// would permanently miss anything that becomes available after the
					// cursor has already moved past its punch_time. biotime_id is
					// unique-constrained on every downstream table, so re-fetching the
					// same window on every poll is safe and cheap - duplicates are
					// just no-ops.
					const startTime = subtractDays(now, SYNC_LOOKBACK_DAYS);

					await db
						.update(biotimeAttendanceSyncState)
						.set({
							lastAttemptedSyncAt: now,
							updatedAt: now,
						})
						.where(eq(biotimeAttendanceSyncState.id, syncState.id));

					return new Response(
						JSON.stringify({
							success: true,
							startTime: startTime.toISOString(),
							endTime: now.toISOString(),
							lookbackDays: SYNC_LOOKBACK_DAYS,
							lastSuccessfulSyncAt: syncState.lastSuccessfulSyncAt
								? syncState.lastSuccessfulSyncAt.toISOString()
								: null,
						}),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
							},
						}
					);
				} catch (error) {
					console.error(error);
					return new Response(JSON.stringify({ error: "Internal server error" }), {
						status: 500,
						headers: {
							"Content-Type": "application/json",
						},
					});
				}
			},
		},
	},
});
