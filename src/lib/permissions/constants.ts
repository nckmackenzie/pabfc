export const PERMISSIONS = [
	"members:view",
	"members:create",
	"members:update",
	"members:delete",
	"members:freeze",
	"members:unfreeze",
	"members:terminate",
	"members:view-profile",
	"attendance:view",
	"plans:view",
	"plans:create",
	"plans:update",
	"plans:delete",
	"dashboard:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
