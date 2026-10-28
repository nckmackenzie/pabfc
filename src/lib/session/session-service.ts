import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { getUserPermissionsByUserId } from "@/lib/permissions/permission-queries";

export const getUserSession = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();

	if (!request?.headers) {
		return null;
	}

	// Bypass the signed cookie cache so revoked or expired sessions are detected.
	const userSession = await auth.api.getSession({
		headers: request.headers,
		query: { disableCookieCache: true },
	});

	if (!userSession) return null;

	return { user: userSession.user, session: userSession.session };
});

export const getAuthContextFn = createServerFn({ method: "GET" }).handler(async () => {
	const userSession = await getUserSession();
	if (!userSession) return null;

	// Members have no staff permissions; skip the lookup on the portal and public pages.
	if (userSession.user.role === "member") {
		return { ...userSession, permissions: [] as string[], roles: [] as string[] };
	}

	try {
		const { permissions, roles } = await getUserPermissionsByUserId(userSession.user.id);
		return { ...userSession, permissions, roles };
	} catch (error) {
		// Fail closed: the user stays signed in but without any granted permissions.
		console.error("Failed to load user permissions", error);
		return { ...userSession, permissions: [] as string[], roles: [] as string[] };
	}
});
