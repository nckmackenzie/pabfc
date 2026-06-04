import { createFileRoute } from "@tanstack/react-router";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	attendanceLogs,
	biotimeAttendanceSyncState,
	biotimeUnmappedAttendanceTransactions,
	memberAccessProfiles,
} from "@/drizzle/schema";
import { authenticateAccessAgent } from "@/services/access-control";

type BioTimeTransactionUpload = {
	id: number;
	empCode: string;
	punchTime: string;
	punchState?: string | null;
	punchStateDisplay?: string | null;
	terminalSn?: string | null;
	raw?: unknown;
};

export const Route = createFileRoute(
	"/api/access-control/agent/attendance-sync/upload/",
)({
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

				const body = await request.json();
				const startTime = body.startTime ? new Date(body.startTime) : null;
				const endTime = body.endTime ? new Date(body.endTime) : null;

				const transactions = (body.transactions ??
					[]) as Array<BioTimeTransactionUpload>;
				if (!startTime || Number.isNaN(startTime.getTime())) {
					return new Response(JSON.stringify({ error: "Invalid startTime" }), {
						status: 400,
					});
				}

				if (!endTime || Number.isNaN(endTime.getTime())) {
					return new Response(JSON.stringify({ error: "Invalid endTime" }), {
						status: 400,
					});
				}

				if (!Array.isArray(transactions)) {
					return new Response(
						JSON.stringify({ error: "transactions must be an array" }),
						{ status: 400 },
					);
				}

				const now = new Date();

				try {
					const result = await db.transaction(async (tx) => {
						const validTransactions = transactions.filter((txItem) => {
							return (
								typeof txItem.id === "number" &&
								typeof txItem.empCode === "string" &&
								txItem.empCode.trim().length > 0 &&
								typeof txItem.punchTime === "string" &&
								!Number.isNaN(new Date(txItem.punchTime).getTime())
							);
						});

						const empCodes = [
							...new Set(
								validTransactions.map((txItem) => txItem.empCode.trim()),
							),
						];

						let memberMap = new Map<string, string>();

						if (empCodes.length > 0) {
							const profiles = await tx
								.select({
									memberId: memberAccessProfiles.memberId,
									empCode: memberAccessProfiles.biotimeEmployeeCode,
								})
								.from(memberAccessProfiles)
								.where(
									inArray(memberAccessProfiles.biotimeEmployeeCode, empCodes),
								);

							memberMap = new Map(
								profiles.map((profile) => [profile.empCode, profile.memberId]),
							);
						}

						const mappedRows = [];
						const unmappedRows = [];

						for (const txItem of validTransactions) {
							const empCode = txItem.empCode.trim();
							const memberId = memberMap.get(empCode);
							const punchTime = new Date(txItem.punchTime);

							if (!memberId) {
								unmappedRows.push({
									biotimeId: txItem.id,
									empCode,
									punchTime,
									punchState: txItem.punchState ?? null,
									punchStateDisplay: txItem.punchStateDisplay ?? null,
									terminalSn: txItem.terminalSn ?? null,
									rawPayload: txItem.raw ?? txItem,
									resolved: false,
									createdAt: now,
									updatedAt: now,
								});

								continue;
							}

							mappedRows.push({
								memberId,
								checkInTime: punchTime,
								checkOutTime: null,
								source: "biotime",
								deviceId: txItem.terminalSn ?? null,
								notes: txItem.punchStateDisplay
									? `Imported from BioTime - ${txItem.punchStateDisplay}`
									: "Imported from BioTime",
								biotimeId: txItem.id,
								createdAt: now,
							});
						}

						let insertedCount = 0;
						let unmappedInsertedCount = 0;

						if (mappedRows.length > 0) {
							const inserted = await tx
								.insert(attendanceLogs)
								.values(mappedRows)
								.onConflictDoNothing({
									target: attendanceLogs.biotimeId,
								})
								.returning({
									id: attendanceLogs.id,
								});

							insertedCount = inserted.length;
						}

						if (unmappedRows.length > 0) {
							const insertedUnmapped = await tx
								.insert(biotimeUnmappedAttendanceTransactions)
								.values(unmappedRows)
								.onConflictDoNothing({
									target: biotimeUnmappedAttendanceTransactions.biotimeId,
								})
								.returning({
									id: biotimeUnmappedAttendanceTransactions.id,
								});

							unmappedInsertedCount = insertedUnmapped.length;
						}

						const skippedDuplicateCount =
							validTransactions.length - insertedCount - unmappedInsertedCount;

						const syncState =
							await tx.query.biotimeAttendanceSyncState.findFirst();

						if (syncState) {
							await tx
								.update(biotimeAttendanceSyncState)
								.set({
									lastSuccessfulSyncAt: endTime,
									lastAttemptedSyncAt: now,
									lastFetchedStartTime: startTime,
									lastFetchedEndTime: endTime,
									lastInsertedCount: insertedCount,
									lastSkippedDuplicateCount: skippedDuplicateCount,
									lastUnmappedCount: unmappedInsertedCount,
									lastError: null,
									updatedAt: now,
								})
								.where(eq(biotimeAttendanceSyncState.id, syncState.id));
						} else {
							await tx.insert(biotimeAttendanceSyncState).values({
								lastSuccessfulSyncAt: endTime,
								lastAttemptedSyncAt: now,
								lastFetchedStartTime: startTime,
								lastFetchedEndTime: endTime,
								lastInsertedCount: insertedCount,
								lastSkippedDuplicateCount: skippedDuplicateCount,
								lastUnmappedCount: unmappedInsertedCount,
								lastError: null,
								createdAt: now,
								updatedAt: now,
							});
						}

						return {
							receivedCount: transactions.length,
							validCount: validTransactions.length,
							insertedCount,
							unmappedCount: unmappedInsertedCount,
							skippedDuplicateCount,
						};
					});

					return new Response(
						JSON.stringify({
							success: true,
							...result,
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
						JSON.stringify({
							success: false,
							message: "Failed to process job",
						}),
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
