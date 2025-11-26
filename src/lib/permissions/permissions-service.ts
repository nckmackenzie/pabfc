import { createServerFn } from "@tanstack/react-start";
import { AuthenticationError } from "@/lib/error-handling/app-error";
import type { Permission } from "@/lib/permissions/constants";
import {
	getUserPermissionsByUserId,
	userHasAnyPermission,
	userHasPermission,
	userHasRole,
} from "@/lib/permissions/permission-queries";
import { getUserSession } from "@/lib/session/session-service";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type { UserPermissions } from "@/lib/permissions/permission-queries";

export const getUserPermissions = createServerFn()
	.middleware([authMiddleware])
	.handler(
		async ({
			context: {
				user: { id: userId },
			},
		}) => {
			return getUserPermissionsByUserId(userId);
		},
	);

export const hasPermission = createServerFn()
	.inputValidator((permission: Permission) => permission)
	.handler(async ({ data: permission }) => {
		const session = await getUserSession();
		if (!session) {
			throw new AuthenticationError("No user session found");
		}
		return userHasPermission(session.user.id, session.user.role, permission);
	});

export const hasAnyPermission = createServerFn()
	.inputValidator((permissionList: Array<Permission>) => permissionList)
	.handler(async ({ data: permissionList }) => {
		const session = await getUserSession();
		if (!session) {
			throw new AuthenticationError("No user session found");
		}
		return userHasAnyPermission(
			session.user.id,
			session.user.role,
			permissionList,
		);
	});

export const hasRole = createServerFn()
	.inputValidator((roleName: string) => roleName)
	.handler(async ({ data: roleName }) => {
		const session = await getUserSession();
		if (!session) {
			throw new AuthenticationError("No user session found");
		}
		return userHasRole(session.user.id, session.user.role, roleName);
	});

// Legacy function for backward compatibility
export async function isAdmin(): Promise<boolean> {
	const session = await getUserSession();
	if (!session) {
		throw new Error("No user found!");
	}
	return session.user.role === "admin";
}
