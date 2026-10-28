import { useRouteContext } from "@tanstack/react-router";
import { can, canAny } from "@/lib/permissions/can";
import type { Permission } from "@/lib/permissions/constants";

export function usePermissions() {
	const auth = useRouteContext({ from: "/app", select: (context) => context.auth });
	const isAdmin = auth.user.role === "admin";

	return {
		permissions: auth.permissions,
		roles: auth.roles,
		isAdmin,
		hasPermission: (permission: Permission | Permission[]) =>
			Array.isArray(permission) ? canAny(auth, permission) : can(auth, permission),
		hasAnyPermission: (permissions: Permission[]) => canAny(auth, permissions),
		hasAllPermissions: (permissions: Permission[]) =>
			permissions.every((permission) => can(auth, permission)),
		hasRole: (role: string) => isAdmin || auth.roles.includes(role),
	};
}
