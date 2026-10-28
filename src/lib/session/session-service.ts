import { createServerFn } from "@tanstack/react-start";
import { getRequestAuthContext, getRequestSession } from "@/lib/session/request-auth";

export const getUserSession = createServerFn({ method: "GET" }).handler(async () => {
	const userSession = await getRequestSession();
	if (!userSession) return null;

	return { user: userSession.user, session: userSession.session };
});

export const getAuthContextFn = createServerFn({ method: "GET" }).handler(() =>
	getRequestAuthContext()
);
