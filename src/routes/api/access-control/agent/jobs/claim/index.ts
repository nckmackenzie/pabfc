import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accessControlSyncJobs } from "@/drizzle/schema";
import { authenticateAccessAgent } from "@/services/access-control";

export const Route = createFileRoute("/api/access-control/agent/jobs/claim/")({
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

				const now = new Date();
				const claimedUntil = new Date(now.getTime() + 5 * 60 * 1000);

				const settings = await db.query.biotimeSettings.findFirst();

				if (!settings?.syncEnabled) {
					return new Response(
						JSON.stringify({ error: "Biotime settings not found" }),
						{
							status: 200,
							headers: {
								"Content-Type": "application/json",
							},
						},
					);
				}

				const batchSize = settings.batchSize ?? 10;

				try {
					const jobs = await db.transaction(async (tx) => {
						// 1. Release abandoned jobs
						await tx
							.update(accessControlSyncJobs)
							.set({
								status: "pending",
								claimedAt: null,
								claimedUntil: null,
								updatedAt: now,
							})
							.where(
								and(
									eq(accessControlSyncJobs.status, "processing"),
									lt(accessControlSyncJobs.claimedUntil, now),
								),
							);

						// 2. Select pending jobs
						const pendingJobs = await tx
							.select()
							.from(accessControlSyncJobs)
							.where(
								and(
									eq(accessControlSyncJobs.status, "pending"),
									lte(
										accessControlSyncJobs.attempts,
										accessControlSyncJobs.maxAttempts,
									),
								),
							)
							.orderBy(asc(accessControlSyncJobs.createdAt))
							.limit(batchSize);

						if (pendingJobs.length === 0) {
							return [];
						}

						const jobIds = pendingJobs.map((job) => job.id);

						// 3. Mark selected jobs as processing
						const claimedJobs = await tx
							.update(accessControlSyncJobs)
							.set({
								status: "processing",
								claimedAt: now,
								claimedUntil,
								attempts: sql`${accessControlSyncJobs.attempts} + 1`,
								updatedAt: now,
							})
							.where(inArray(accessControlSyncJobs.id, jobIds))
							.returning();

						return claimedJobs;
					});

					return new Response(JSON.stringify({ success: true, jobs }), {
						status: 200,
						headers: {
							"Content-Type": "application/json",
						},
					});
				} catch (error) {
					console.error(error);
					return new Response(
						JSON.stringify({ error: "Internal Server Error" }),
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
