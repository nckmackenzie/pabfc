import { createMiddleware } from "@tanstack/react-start";

import {
	AuthenticationError,
	AuthorizationError,
} from "@/lib/error-handling/app-error";
import { getUserSession } from "@/lib/session/session-service";
// import type { Permission } from '@/lib/permissions/constants'
// import { hasAnyPermission } from '@/lib/permissions/permissions-service'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
	const session = await getUserSession();

	if (!session?.user) {
		throw new AuthenticationError("Please log in to continue");
	}

	return next({
		context: {
			...session,
		},
	});
});

export const adminMiddleware = createMiddleware()
	.middleware([authMiddleware])
	.server(async ({ context, next }) => {
		if (context.user.role !== "admin") {
			throw new AuthorizationError(
				"This action requires administrator privileges",
			);
		}

		return next();
	});

// Staff-only access for lookup endpoints that are shared by many forms and have no single
// owning permission. Portal members are signed in but must not reach internal data.
export const staffMiddleware = createMiddleware()
	.middleware([authMiddleware])
	.server(async ({ context, next }) => {
		if (context.user.role === "member") {
			throw new AuthorizationError("This action is restricted to staff");
		}

		return next();
	});
