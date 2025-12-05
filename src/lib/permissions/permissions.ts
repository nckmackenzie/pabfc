import { redirect } from "@tanstack/react-router";
import type { Permission } from "@/lib/permissions/constants";
import {
	hasAnyPermission,
	hasPermission,
	hasRole,
} from "@/lib/permissions/permissions-service";
import { getUserSession } from "@/lib/session/session-service";

export async function getLoggedInUser() {
	const session = await getUserSession();

	if (!session) {
		throw redirect({ to: "/sign-in" });
	}
}

export const requirePermission = async (permission: Permission) => {
	await getLoggedInUser();
	const userHasPermission = await hasPermission({ data: permission });

	if (!userHasPermission) {
		throw new Error(
			"You do not have the required permissions to access this resource.",
		);
	}
};

export async function requireAnyPermission(permissionList: Array<Permission>) {
	await getLoggedInUser();
	const userHasPermission = await hasAnyPermission({ data: permissionList });

	if (!userHasPermission) {
		throw new Error(
			"You do not have any of the required permissions to access this resource.",
		);
	}
}

export async function requireRole(roleName: string) {
	await getLoggedInUser();
	const userHasRole = await hasRole({ data: roleName });

	if (!userHasRole) {
		throw new Error(
			"You do not have the required role to access this resource.",
		);
	}
}
