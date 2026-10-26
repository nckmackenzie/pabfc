import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	accessControlSyncAttempts,
	accessControlSyncJobs,
	biotimePersonProfiles,
} from "@/drizzle/schema";
import {
	softDeleteEmployeeLocally,
	softDeleteMemberLocally,
} from "@/lib/access-control";
import { authenticateAccessAgent } from "@/services/access-control";
import { syncAccessAfterEmployeeCreated } from "@/services/member-access";

type AccessSyncJobPayload = {
	areaIds?: number[];
	biotimeEmployeeId?: number;
	[key: string]: unknown;
};

function getJobPayload(payload: unknown): AccessSyncJobPayload {
	if (!payload || typeof payload !== "object") return {};
	return payload as AccessSyncJobPayload;
}

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

					if (
						job.status !== "processing" ||
						!job.claimedUntil ||
						job.claimedUntil < now
					) {
						return new Response(
							JSON.stringify({
								success: false,
								message: "Job is no longer claimable by this success callback",
							}),
							{
								status: 409,
								headers: {
									"Content-Type": "application/json",
								},
							},
						);
					}

					const payload = getJobPayload(job.payload);

					const result = await db.transaction(async (tx) => {
						// 1. Mark job succeeded
						const updatedJobs = await tx
							.update(accessControlSyncJobs)
							.set({
								status: "succeeded",
								completedAt: now,
								lastError: null,
								updatedAt: now,
							})
							.where(
								and(
									eq(accessControlSyncJobs.id, job.id),
									eq(accessControlSyncJobs.status, "processing"),
									gt(accessControlSyncJobs.claimedUntil, now),
								),
							)
							.returning({ id: accessControlSyncJobs.id });

						if (updatedJobs.length === 0) {
							return { conflict: true } as const;
						}

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
							const responseArea = body.responsePayload?.area;
							const firstArea = Array.isArray(responseArea) ? responseArea[0] : undefined;
							const createdAreaId: number | null =
								typeof firstArea === "number" ? firstArea : (firstArea?.id ?? null);
							const biotimeEmployeeId: number | null = body.responsePayload?.id ?? null;
							// Members are registered without access, so their desired access is
							// left as the profile holds it (a membership may have been bought
							// while this job was queued). Employees keep the original behaviour.
							const isMember = job.personType === "member" && !!job.memberId;

							await tx
								.update(biotimePersonProfiles)
								.set({
									biotimeEmployeeId,
									currentAreaId: createdAreaId ?? (payload.areaIds?.[0] ?? 2),
									...(isMember
										? {}
										: { desiredAccessEnabled: true, accessControlStatus: "active" as const }),
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(
									eq(biotimePersonProfiles.id, job.biotimePersonProfileId),
								);

							if (isMember && job.memberId && biotimeEmployeeId !== null) {
								await syncAccessAfterEmployeeCreated(tx, {
									profileId: job.biotimePersonProfileId,
									memberId: job.memberId,
									biotimeEmployeeId,
									createdAreaId,
								});
							}
						}

						if (job.action === "ENABLE_ACCESS") {
							await tx
								.update(biotimePersonProfiles)
								.set({
									desiredAccessEnabled: true,
									currentAreaId: payload.areaIds?.[0] ?? 2,
									accessControlStatus: "active",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(
									eq(biotimePersonProfiles.id, job.biotimePersonProfileId),
								);
						}

						if (job.action === "DISABLE_ACCESS") {
							await tx
								.update(biotimePersonProfiles)
								.set({
									desiredAccessEnabled: false,
									currentAreaId: payload.areaIds?.[0] ?? 1,
									accessControlStatus: "disabled",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(
									eq(biotimePersonProfiles.id, job.biotimePersonProfileId),
								);
						}

						if (job.action === "UPDATE_EMPLOYEE") {
							await tx
								.update(biotimePersonProfiles)
								.set({
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(
									eq(biotimePersonProfiles.id, job.biotimePersonProfileId),
								);
						}

						if (job.action === "RESIGN_EMPLOYEE") {
							await tx
								.update(biotimePersonProfiles)
								.set({
									desiredAccessEnabled: false,
									currentAreaId: null,
									accessControlStatus: "resigned",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									biotimeResignId:
										body.responsePayload?.id ??
										body.responsePayload?.data?.id ??
										null,
									updatedAt: now,
								})
								.where(
									eq(biotimePersonProfiles.id, job.biotimePersonProfileId),
								);
						}

						if (job.action === "DELETE_EMPLOYEE") {
							await tx
								.update(biotimePersonProfiles)
								.set({
									desiredAccessEnabled: false,
									currentAreaId: null,
									accessControlStatus: "deleted",
									lastSyncedAt: now,
									lastSyncAttemptAt: now,
									lastSyncError: null,
									lastSyncResponse: body.responsePayload ?? null,
									updatedAt: now,
								})
								.where(
									eq(biotimePersonProfiles.id, job.biotimePersonProfileId),
								);

							if (job.personType === "member" && job.memberId) {
								await softDeleteMemberLocally({
									memberId: job.memberId,
									tx,
								});
							}

							if (job.personType === "employee" && job.employeeId) {
								await softDeleteEmployeeLocally({
									employeeId: job.employeeId,
									tx,
								});
							}
						}

						return { conflict: false } as const;
					});

					if (result.conflict) {
						return new Response(
							JSON.stringify({
								success: false,
								message: "Job is no longer claimable by this success callback",
							}),
							{
								status: 409,
								headers: {
									"Content-Type": "application/json",
								},
							},
						);
					}

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
