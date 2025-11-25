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
