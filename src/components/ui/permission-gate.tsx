import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import type { Permission } from "@/lib/permissions/constants";

interface PermissionGateProps {
	children: ReactNode;
	permission?: Permission;
	permissions?: Array<Permission>;
	requireAll?: boolean;
	role?: string;
	fallback?: ReactNode;
}

export function PermissionGate({
	children,
	permission,
	permissions,
	requireAll = false,
	role,
	fallback = null,
}: PermissionGateProps) {
	const {
		hasPermission,
		hasAnyPermission,
		hasAllPermissions,
		hasRole,
		isLoading,
	} = usePermissions();

	if (isLoading) {
		return null;
	}

	let hasAccess = false;

	if (permission) {
		hasAccess = hasPermission(permission);
	} else if (permissions) {
		hasAccess = requireAll
			? hasAllPermissions(permissions)
			: hasAnyPermission(permissions);
	} else if (role) {
		hasAccess = hasRole(role);
	}

	return hasAccess ? children : fallback;
}
