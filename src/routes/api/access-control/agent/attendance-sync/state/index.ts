import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { biotimeAttendanceSyncState } from "@/drizzle/schema";
import { authenticateAccessAgent } from "@/services/access-control";

const SAFETY_OVERLAP_MINUTES = 10;

function startOfToday() {
	const now = new Date();

	return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function subtractMinutes(date: Date, minutes: number) {
	return new Date(date.getTime() - minutes * 60 * 1000);
}

export const Route = createFileRoute(
	"/api/access-control/agent/attendance-sync/state/",
)({
	server: {
		handlers: {
			GET: async ({ request }) => {
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

					const startTime = syncState.lastSuccessfulSyncAt
						? subtractMinutes(
								syncState.lastSuccessfulSyncAt,
								SAFETY_OVERLAP_MINUTES,
							)
						: startOfToday();

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
							safetyOverlapMinutes: SAFETY_OVERLAP_MINUTES,
							lastSuccessfulSyncAt: syncState.lastSuccessfulSyncAt
								? syncState.lastSuccessfulSyncAt.toISOString()
								: null,
						}),
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
						JSON.stringify({ error: "Internal server error" }),
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
