import { redirect } from "@tanstack/react-router";
import { can, canAny } from "@/lib/permissions/can";
import type { Permission } from "@/lib/permissions/constants";
import { getRequestAuthContext } from "@/lib/session/request-auth";

export async function getLoggedInUser() {
	const auth = await getRequestAuthContext();

	if (!auth) {
		throw redirect({ to: "/sign-in" });
	}

	return auth;
}

export const requirePermission = async (permission: Permission) => {
	const auth = await getLoggedInUser();

	if (!can(auth, permission)) {
		throw new Error("You do not have the required permissions to access this resource.");
	}
};

export async function requireAnyPermission(permissionList: Array<Permission>) {
	const auth = await getLoggedInUser();

	if (!canAny(auth, permissionList)) {
		throw new Error("You do not have any of the required permissions to access this resource.");
	}
}

export async function requireRole(roleName: string) {
	const auth = await getLoggedInUser();

	if (auth.user.role !== "admin" && !auth.roles.includes(roleName)) {
		throw new Error("You do not have the required role to access this resource.");
	}
}
