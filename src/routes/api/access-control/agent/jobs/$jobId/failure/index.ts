import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	accessControlSyncAttempts,
	accessControlSyncJobs,
	memberAccessProfiles,
} from "@/drizzle/schema";
import { authenticateAccessAgent } from "@/services/access-control";

export const Route = createFileRoute(
	"/api/access-control/agent/jobs/$jobId/failure/",
)({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				try {
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
					const now = new Date();

					const job = await db.query.accessControlSyncJobs.findFirst({
						where: eq(accessControlSyncJobs.id, params.jobId),
					});

					if (!job)
						return new Response(JSON.stringify({ error: "Job not found" }), {
							status: 404,
							headers: {
								"Content-Type": "application/json",
							},
						});

					const hasReachedMaxAttempts = job.attempts >= job.maxAttempts;

					await db.transaction(async (tx) => {
						// 1. Mark job failed or return it to pending
						await tx
							.update(accessControlSyncJobs)
							.set({
								status: hasReachedMaxAttempts ? "failed" : "pending",
								claimedAt: null,
								claimedUntil: null,
								lastError: body.errorMessage ?? "Unknown BioTime sync error",
								updatedAt: now,
							})
							.where(eq(accessControlSyncJobs.id, job.id));

						// 2. Log attempt
						await tx.insert(accessControlSyncAttempts).values({
							jobId: job.id,
							success: false,
							requestPayload: job.payload,
							responsePayload: body.responsePayload ?? null,
							errorMessage: body.errorMessage ?? "Unknown BioTime sync error",
						});

						// 3. Update member access profile
						await tx
							.update(memberAccessProfiles)
							.set({
								accessControlStatus: hasReachedMaxAttempts
									? "sync_failed"
									: "pending_sync",
								lastSyncAttemptAt: now,
								lastSyncError:
									body.errorMessage ?? "Unknown BioTime sync error",
								lastSyncResponse: body.responsePayload ?? null,
								updatedAt: now,
							})
							.where(eq(memberAccessProfiles.memberId, job.memberId));
					});

					return new Response(
						JSON.stringify({
							success: true,
							message: hasReachedMaxAttempts
								? "Job marked as failed"
								: "Job returned to pending state for retry",
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
