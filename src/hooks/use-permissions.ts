import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSession } from "@/lib/auth/client";
import type { Permission } from "@/lib/permissions/constants";
import { getUserPermissions } from "@/lib/permissions/permissions-service";

export function usePermissions() {
	const { data: session, isPending } = useSession();

	const { data: userPermissions, isLoading } = useQuery({
		queryKey: ["permissions", session?.user.id],
		queryFn: () => getUserPermissions(),
		enabled: !!session?.user.id,
	});

	const permissions = useMemo(() => {
		if (!userPermissions) return [];
		return userPermissions.permissions;
	}, [userPermissions]);

	const roles = useMemo(() => {
		if (!userPermissions) return [];
		return userPermissions.roles;
	}, [userPermissions]);

	const hasPermission = (permission: Permission): boolean => {
		if (session?.user.role === "admin") return true;
		return permissions.includes(permission);
	};

	const hasAnyPermission = (permissionList: Array<Permission>): boolean => {
		if (session?.user.role === "admin") return true;
		return permissionList.some((permission) =>
			permissions.includes(permission),
		);
	};

	const hasAllPermissions = (permissionList: Array<Permission>): boolean => {
		if (session?.user.role === "admin") return true;
		return permissionList.every((permission) =>
			permissions.includes(permission),
		);
	};

	const hasRole = (roleName: string): boolean => {
		if (session?.user.role === "admin") return true;
		return roles.includes(roleName);
	};

	return {
		permissions,
		roles,
		hasPermission,
		hasAnyPermission,
		hasAllPermissions,
		hasRole,
		isLoading: isLoading || isPending,
	};
}
