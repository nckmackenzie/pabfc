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
	"/api/access-control/agent/jobs/$jobId/success/",
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

					await db.transaction(async (tx) => {
						// 1. Mark job succeeded
						await tx
							.update(accessControlSyncJobs)
							.set({
								status: "succeeded",
								completedAt: now,
								lastError: null,
								updatedAt: now,
							})
							.where(eq(accessControlSyncJobs.id, job.id));

						// 2. Log sync attempt
						await tx.insert(accessControlSyncAttempts).values({
							jobId: job.id,
							success: true,
							requestPayload: job.payload,
							responsePayload: body.responsePayload ?? null,
							errorMessage: null,
						});

						// 3. Update member access profile depending on job action
						if (job.action === "CREATE_EMPLOYEE") {
							await tx
								.update(memberAccessProfiles)
								.set({
									biotimeEmployeeId: body.responsePayload?.id ?? null,
									currentAreaId: Array.isArray(body.responsePayload?.area)
										? body.responsePayload.area[0]
										: 2,
									desiredAccessEnabled: true,
									accessControlStatus: "active",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(eq(memberAccessProfiles.memberId, job.memberId));
						}

						if (job.action === "ENABLE_ACCESS") {
							await tx
								.update(memberAccessProfiles)
								.set({
									desiredAccessEnabled: true,
									currentAreaId: 2,
									accessControlStatus: "active",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(eq(memberAccessProfiles.memberId, job.memberId));
						}

						if (job.action === "DISABLE_ACCESS") {
							await tx
								.update(memberAccessProfiles)
								.set({
									desiredAccessEnabled: false,
									currentAreaId: 1,
									accessControlStatus: "disabled",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(eq(memberAccessProfiles.memberId, job.memberId));
						}

						if (job.action === "UPDATE_EMPLOYEE") {
							await tx
								.update(memberAccessProfiles)
								.set({
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(eq(memberAccessProfiles.memberId, job.memberId));
						}
					});

					return new Response(
						JSON.stringify({
							success: true,
							message: "Job marked as succeeded",
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
