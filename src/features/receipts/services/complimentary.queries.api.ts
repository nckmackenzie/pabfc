import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { complimentaryMembershipRequests } from "@/drizzle/schema";
import { complimentaryRequestsSearchSchema } from "@/features/receipts/services/complimentary.schemas";
import { userHasPermission } from "@/lib/permissions/permission-queries";
import { requireAnyPermission, requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getComplimentaryRequests = createServerFn()
	.middleware([authMiddleware])
	.validator(complimentaryRequestsSearchSchema)
	.handler(async ({ data: { status }, context: { user } }) => {
		await requireAnyPermission([
			"receipts:complimentary-request",
			"receipts:complimentary-approve",
		]);

		const canApprove = await userHasPermission(
			user.id,
			user.role,
			"receipts:complimentary-approve"
		);

		return db.query.complimentaryMembershipRequests.findMany({
			where: and(
				status && status !== "all" ? eq(complimentaryMembershipRequests.status, status) : undefined,
				canApprove ? undefined : eq(complimentaryMembershipRequests.requestedByUserId, user.id)
			),
			with: {
				member: { columns: { firstName: true, lastName: true } },
				plan: { columns: { name: true } },
				requestedByUser: { columns: { name: true } },
				reviewedByUser: { columns: { name: true } },
			},
			orderBy: (requests, { desc }) => [desc(requests.createdAt)],
		});
	});

export const getComplimentaryRequestByPaymentId = createServerFn()
	.middleware([authMiddleware])
	.validator((paymentId: string) => paymentId)
	.handler(async ({ data: paymentId }) => {
		await requirePermission("receipts:view");
		return db.query.complimentaryMembershipRequests.findFirst({
			where: eq(complimentaryMembershipRequests.resultingPaymentId, paymentId),
			with: {
				requestedByUser: { columns: { name: true } },
				reviewedByUser: { columns: { name: true } },
			},
		});
	});
