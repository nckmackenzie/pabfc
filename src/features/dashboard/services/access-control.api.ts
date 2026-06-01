import { createServerFn } from "@tanstack/react-start";
import { startOfDay, subMinutes } from "date-fns";
import {
	and,
	desc,
	eq,
	gte,
	ilike,
	isNotNull,
	isNull,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	accessControlAgents,
	accessControlSyncAttempts,
	accessControlSyncJobs,
	memberAccessProfiles,
	members,
} from "@/drizzle/schema";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const accessControlDashboardJobStatusFilters = [
	"all",
	"pending",
	"processing",
	"succeeded",
	"failed",
	"cancelled",
] as const;

export const accessControlDashboardJobActionFilters = [
	"all",
	"CREATE_EMPLOYEE",
	"UPDATE_EMPLOYEE",
	"ENABLE_ACCESS",
	"DISABLE_ACCESS",
	"FULL_RECONCILE",
] as const;

export type AccessControlDashboardJobStatusFilter =
	(typeof accessControlDashboardJobStatusFilters)[number];
export type AccessControlDashboardJobActionFilter =
	(typeof accessControlDashboardJobActionFilters)[number];

export const accessControlDashboardFiltersSchema = z.object({
	status: z.enum(accessControlDashboardJobStatusFilters).optional(),
	action: z.enum(accessControlDashboardJobActionFilters).optional(),
	q: z.string().trim().max(100).optional(),
});

const accessControlJobMutationSchema = z.object({
	jobId: z.string().uuid("Invalid job id"),
});

const memberNameSql = sql<string>`${members.firstName} || ' ' || ${members.lastName}`;
const pendingSyncIssueThresholdMinutes = 15;

export type AccessControlDashboardFilters = z.infer<
	typeof accessControlDashboardFiltersSchema
>;

export const getAccessControlDashboard = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(accessControlDashboardFiltersSchema)
	.handler(async ({ data }) => {
		await requirePermission("dashboard:view");

		const now = new Date();
		const todayStart = startOfDay(now);
		const pendingSyncCutoff = subMinutes(now, pendingSyncIssueThresholdMinutes);
		const q = data.q?.trim();
		const jobFilters = [isNull(members.deletedAt)];

		if (data.status && data.status !== "all") {
			jobFilters.push(eq(accessControlSyncJobs.status, data.status));
		}

		if (data.action && data.action !== "all") {
			jobFilters.push(eq(accessControlSyncJobs.action, data.action));
		}

		if (q) {
			const term = `%${q}%`;
			const searchFilters = or(
				ilike(members.firstName, term),
				ilike(members.lastName, term),
				ilike(memberNameSql, term),
				ilike(memberAccessProfiles.biotimeEmployeeCode, term),
			);

			if (searchFilters) {
				jobFilters.push(searchFilters);
			}
		}

		const [
			agent,
			jobStatusCounts,
			successfulJobsTodayCount,
			membersPendingSyncCount,
			recentJobs,
			failedJobs,
			recentSuccessfulJobs,
			rawRecentAttempts,
			membersWithIssues,
		] = await Promise.all([
			db
				.select({
					id: accessControlAgents.id,
					name: accessControlAgents.name,
					machineName: accessControlAgents.machineName,
					isActive: accessControlAgents.isActive,
					lastSeenAt: accessControlAgents.lastSeenAt,
					lastIpAddress: accessControlAgents.lastIpAddress,
					status: accessControlAgents.status,
					lastError: accessControlAgents.lastError,
					createdAt: accessControlAgents.createdAt,
					updatedAt: accessControlAgents.updatedAt,
				})
				.from(accessControlAgents)
				.orderBy(
					desc(
						sql`COALESCE(${accessControlAgents.lastSeenAt}, ${accessControlAgents.updatedAt})`,
					),
				)
				.limit(1)
				.then((rows) => rows[0] ?? null),
			db
				.select({
					status: accessControlSyncJobs.status,
					count: sql<number>`count(*)::int`,
				})
				.from(accessControlSyncJobs)
				.innerJoin(members, eq(accessControlSyncJobs.memberId, members.id))
				.where(isNull(members.deletedAt))
				.groupBy(accessControlSyncJobs.status),
			db
				.select({
					count: sql<number>`count(*)::int`,
				})
				.from(accessControlSyncJobs)
				.innerJoin(members, eq(accessControlSyncJobs.memberId, members.id))
				.where(
					and(
						isNull(members.deletedAt),
						eq(accessControlSyncJobs.status, "succeeded"),
						gte(accessControlSyncJobs.completedAt, todayStart),
					),
				)
				.then((rows) => rows[0]?.count ?? 0),
			db
				.select({
					count: sql<number>`count(*)::int`,
				})
				.from(memberAccessProfiles)
				.innerJoin(members, eq(memberAccessProfiles.memberId, members.id))
				.where(
					and(
						isNull(members.deletedAt),
						eq(memberAccessProfiles.accessControlStatus, "pending_sync"),
					),
				)
				.then((rows) => rows[0]?.count ?? 0),
			db
				.select({
					id: accessControlSyncJobs.id,
					memberId: accessControlSyncJobs.memberId,
					memberNo: members.memberNo,
					memberName: memberNameSql,
					biotimeEmployeeCode: memberAccessProfiles.biotimeEmployeeCode,
					action: accessControlSyncJobs.action,
					status: accessControlSyncJobs.status,
					attempts: accessControlSyncJobs.attempts,
					maxAttempts: accessControlSyncJobs.maxAttempts,
					lastError: accessControlSyncJobs.lastError,
					createdAt: accessControlSyncJobs.createdAt,
					updatedAt: accessControlSyncJobs.updatedAt,
					completedAt: accessControlSyncJobs.completedAt,
				})
				.from(accessControlSyncJobs)
				.innerJoin(members, eq(accessControlSyncJobs.memberId, members.id))
				.leftJoin(
					memberAccessProfiles,
					eq(memberAccessProfiles.memberId, members.id),
				)
				.where(and(...jobFilters))
				.orderBy(desc(accessControlSyncJobs.createdAt))
				.limit(25),
			db
				.select({
					id: accessControlSyncJobs.id,
					memberId: accessControlSyncJobs.memberId,
					memberNo: members.memberNo,
					memberName: memberNameSql,
					biotimeEmployeeCode: memberAccessProfiles.biotimeEmployeeCode,
					action: accessControlSyncJobs.action,
					status: accessControlSyncJobs.status,
					attempts: accessControlSyncJobs.attempts,
					maxAttempts: accessControlSyncJobs.maxAttempts,
					lastError: accessControlSyncJobs.lastError,
					createdAt: accessControlSyncJobs.createdAt,
					updatedAt: accessControlSyncJobs.updatedAt,
					completedAt: accessControlSyncJobs.completedAt,
				})
				.from(accessControlSyncJobs)
				.innerJoin(members, eq(accessControlSyncJobs.memberId, members.id))
				.leftJoin(
					memberAccessProfiles,
					eq(memberAccessProfiles.memberId, members.id),
				)
				.where(
					and(
						isNull(members.deletedAt),
						eq(accessControlSyncJobs.status, "failed"),
					),
				)
				.orderBy(desc(accessControlSyncJobs.updatedAt))
				.limit(10),
			db
				.select({
					id: accessControlSyncJobs.id,
					memberId: accessControlSyncJobs.memberId,
					memberNo: members.memberNo,
					memberName: memberNameSql,
					biotimeEmployeeCode: memberAccessProfiles.biotimeEmployeeCode,
					action: accessControlSyncJobs.action,
					status: accessControlSyncJobs.status,
					attempts: accessControlSyncJobs.attempts,
					maxAttempts: accessControlSyncJobs.maxAttempts,
					lastError: accessControlSyncJobs.lastError,
					createdAt: accessControlSyncJobs.createdAt,
					updatedAt: accessControlSyncJobs.updatedAt,
					completedAt: accessControlSyncJobs.completedAt,
				})
				.from(accessControlSyncJobs)
				.innerJoin(members, eq(accessControlSyncJobs.memberId, members.id))
				.leftJoin(
					memberAccessProfiles,
					eq(memberAccessProfiles.memberId, members.id),
				)
				.where(
					and(
						isNull(members.deletedAt),
						eq(accessControlSyncJobs.status, "succeeded"),
					),
				)
				.orderBy(desc(accessControlSyncJobs.completedAt))
				.limit(8),
			db
				.select({
					id: accessControlSyncAttempts.id,
					jobId: accessControlSyncAttempts.jobId,
					success: accessControlSyncAttempts.success,
					requestPayload: accessControlSyncAttempts.requestPayload,
					responsePayload: accessControlSyncAttempts.responsePayload,
					errorMessage: accessControlSyncAttempts.errorMessage,
					createdAt: accessControlSyncAttempts.createdAt,
					jobAction: accessControlSyncJobs.action,
					memberId: members.id,
					memberNo: members.memberNo,
					memberName: memberNameSql,
				})
				.from(accessControlSyncAttempts)
				.innerJoin(
					accessControlSyncJobs,
					eq(accessControlSyncAttempts.jobId, accessControlSyncJobs.id),
				)
				.innerJoin(members, eq(accessControlSyncJobs.memberId, members.id))
				.where(isNull(members.deletedAt))
				.orderBy(desc(accessControlSyncAttempts.createdAt))
				.limit(20),
			db
				.select({
					id: memberAccessProfiles.id,
					memberId: members.id,
					memberNo: members.memberNo,
					memberName: memberNameSql,
					biotimeEmployeeCode: memberAccessProfiles.biotimeEmployeeCode,
					biotimeEmployeeId: memberAccessProfiles.biotimeEmployeeId,
					desiredAccessEnabled: memberAccessProfiles.desiredAccessEnabled,
					currentAreaId: memberAccessProfiles.currentAreaId,
					accessControlStatus: memberAccessProfiles.accessControlStatus,
					biometricEnrollmentStatus:
						memberAccessProfiles.biometricEnrollmentStatus,
					lastSyncAttemptAt: memberAccessProfiles.lastSyncAttemptAt,
					lastSyncedAt: memberAccessProfiles.lastSyncedAt,
					lastSyncError: memberAccessProfiles.lastSyncError,
				})
				.from(memberAccessProfiles)
				.innerJoin(members, eq(memberAccessProfiles.memberId, members.id))
				.where(
					and(
						isNull(members.deletedAt),
						or(
							eq(memberAccessProfiles.accessControlStatus, "sync_failed"),
							and(
								eq(memberAccessProfiles.accessControlStatus, "pending_sync"),
								sql`COALESCE(${memberAccessProfiles.lastSyncAttemptAt}, ${memberAccessProfiles.updatedAt}) <= ${pendingSyncCutoff}`,
							),
							isNotNull(memberAccessProfiles.lastSyncError),
						),
					),
				)
				.orderBy(
					desc(
						sql`COALESCE(${memberAccessProfiles.lastSyncAttemptAt}, ${memberAccessProfiles.updatedAt})`,
					),
				)
				.limit(25),
		]);

		const recentAttempts = rawRecentAttempts.map((attempt) => ({
			...attempt,
			requestPayload: (attempt.requestPayload ?? null) as object | null,
			responsePayload: (attempt.responsePayload ?? null) as object | null,
		}));

		const countByStatus = {
			pending: 0,
			processing: 0,
			succeeded: 0,
			failed: 0,
			cancelled: 0,
		};

		for (const row of jobStatusCounts) {
			countByStatus[row.status] = row.count;
		}

		return {
			agent,
			kpis: {
				pendingJobsCount: countByStatus.pending,
				failedJobsCount: countByStatus.failed,
				processingJobsCount: countByStatus.processing,
				successfulJobsTodayCount,
				membersPendingSyncCount,
			},
			recentJobs,
			failedJobs,
			recentSuccessfulJobs,
			recentAttempts,
			membersWithIssues,
			pendingSyncIssueThresholdMinutes,
		};
	});

export const retryAccessControlJob = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(accessControlJobMutationSchema)
	.handler(async ({ data: { jobId } }) => {
		await requirePermission("dashboard:view");

		const job = await db.query.accessControlSyncJobs.findFirst({
			where: eq(accessControlSyncJobs.id, jobId),
		});

		if (!job) {
			throw new NotFoundError("Sync job not found");
		}

		const updated = await db
			.update(accessControlSyncJobs)
			.set({
				status: "pending",
				attempts: 0,
				lastError: null,
				claimedAt: null,
				claimedUntil: null,
				completedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(accessControlSyncJobs.id, jobId),
					eq(accessControlSyncJobs.status, "failed"),
				),
			)
			.returning({ id: accessControlSyncJobs.id });

		if (updated.length === 0) {
			throw new ConflictError("Job is no longer failed");
		}

		return { success: true };
	});

export const cancelAccessControlJob = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(accessControlJobMutationSchema)
	.handler(async ({ data: { jobId } }) => {
		await requirePermission("dashboard:view");

		const job = await db.query.accessControlSyncJobs.findFirst({
			where: eq(accessControlSyncJobs.id, jobId),
		});

		if (!job) {
			throw new NotFoundError("Sync job not found");
		}

		if (job.status !== "pending" && job.status !== "failed") {
			throw new ConflictError("Only pending or failed jobs can be cancelled");
		}

		await db
			.update(accessControlSyncJobs)
			.set({
				status: "cancelled",
				claimedAt: null,
				claimedUntil: null,
				updatedAt: new Date(),
			})
			.where(eq(accessControlSyncJobs.id, jobId));

		return { success: true };
	});
