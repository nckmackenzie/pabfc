import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { complimentaryMembershipRequests } from "@/drizzle/schema";
import { complimentaryRequestsSearchSchema } from "@/features/receipts/services/complimentary.schemas";
import { getUserPermissionsByUserId } from "@/lib/permissions/permission-queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getComplimentaryRequests = createServerFn()
	.middleware([authMiddleware])
	.validator(complimentaryRequestsSearchSchema)
	.handler(async ({ data: { status }, context: { user } }) => {
		const isAdmin = user.role === "admin";
		const userPermissions = isAdmin ? null : await getUserPermissionsByUserId(user.id);
		const canRequest =
			isAdmin || !!userPermissions?.permissions.includes("receipts:complimentary-request");
		const canApprove =
			isAdmin || !!userPermissions?.permissions.includes("receipts:complimentary-approve");

		if (!canRequest && !canApprove) {
			throw new Error("You do not have any of the required permissions to access this resource.");
		}

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
