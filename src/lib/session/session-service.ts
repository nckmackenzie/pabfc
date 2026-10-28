import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import { getUserPermissionsByUserId } from "@/lib/permissions/permission-queries";

export const getUserSession = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();

	if (!request?.headers) {
		return null;
	}

	const userSession = await auth.api.getSession({
		headers: request.headers,
		query: { disableCookieCache: true },
	});

	if (!userSession) return null;

	return { user: userSession.user, session: userSession.session };
});

export const getAuthContextFn = createServerFn({ method: "GET" }).handler(async () => {
	const request = getRequest();
	if (!request?.headers) return null;
	const userSession = await auth.api.getSession({
		headers: request.headers,
		query: { disableCookieCache: true },
	});
	if (!userSession) return null;
	const { permissions, roles } = await getUserPermissionsByUserId(userSession.user.id);
	return { user: userSession.user, session: userSession.session, permissions, roles };
});
