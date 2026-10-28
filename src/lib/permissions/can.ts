import type { Permission } from "@/lib/permissions/constants";
import type { getAuthContextFn } from "@/lib/session/session-service";

export type AuthContext = Awaited<ReturnType<typeof getAuthContextFn>>;

export function can(auth: AuthContext, permission: Permission): boolean {
	return auth?.user.role === "admin" || !!auth?.permissions.includes(permission);
}

export function canAny(auth: AuthContext, permissions: Permission[]): boolean {
	return permissions.some((permission) => can(auth, permission));
}

export function assertCan(auth: AuthContext, permission: Permission): void {
	if (!can(auth, permission)) {
		throw new Error("You do not have the required permissions to access this resource.");
	}
}

export function assertCanAny(auth: AuthContext, permissions: Permission[]): void {
	if (!canAny(auth, permissions)) {
		throw new Error("You do not have any of the required permissions to access this resource.");
	}
}
