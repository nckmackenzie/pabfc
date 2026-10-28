import { useRouteContext } from "@tanstack/react-router";
import type { Permission } from "@/lib/permissions/constants";
import { can } from "@/lib/permissions/can";

export function usePermissions() {
	const auth = useRouteContext({ from: "/app", select: (context) => context.auth });
	const hasPermission = (permission: Permission | Permission[]) =>
		Array.isArray(permission) ? permission.some((item) => can(auth, item)) : can(auth, permission);
	return {
		permissions: auth.permissions,
		roles: auth.roles,
		hasPermission,
		hasAnyPermission: (permissions: Permission[]) => permissions.some((item) => can(auth, item)),
		hasAllPermissions: (permissions: Permission[]) => permissions.every((item) => can(auth, item)),
		hasRole: (role: string) => auth.user.role === "admin" || auth.roles.includes(role),
		isLoading: false,
	};
}
