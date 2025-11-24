import type { users } from "@/drizzle/schema";
import type { FileRoutesByTo } from "@/routeTree.gen";

export type ColorVariant = "success" | "warning" | "error" | "info";

export type User = typeof users.$inferSelect;

export interface UserPermissions {
	userId: string;
	permissions: Array<string>;
	roles: Array<string>;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
	createdAt: Date;
	ipAddress?: string;
	userAgent?: string;
}

export interface SessionWithUser extends Session {
	user: User;
}

export interface WithId {
	id: string;
}

export interface WithName {
	name: string;
}

export interface WithCreatedAt {
	createdAt: string;
}

export interface WithIdAndName extends WithId, WithName {}

export interface IsEdit {
	isEdit?: boolean;
}

export type IsEditRequired = Required<IsEdit>;

export interface IsPending {
	isPending: boolean;
}

export interface Form {
	id: number;
	name: string;
	module: string;
	path: string;
}

export interface Option {
	value: string;
	label: string;
}

export type ApiSuccess = {
	error: false;
	data: string;
	message: string;
};

export type ApiFailure = {
	error: true;
	data: null;
	message: string;
};

export type ApiSuccessWithoutData = Omit<ApiSuccess, "data">;
export type ApiFailureWithoutData = Omit<ApiFailure, "data">;

export type SchemaValidationSuccess<T> = {
	error: null;
	data: T;
};

export type SchemaValidationFailure = {
	error: string;
	data: null;
};

export type Route = keyof FileRoutesByTo;
