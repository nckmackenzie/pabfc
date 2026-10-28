import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";
import {
	getUserPermissionsByUserId,
	type UserPermissions,
} from "@/lib/permissions/permission-queries";

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

// A single request can trigger several auth checks (middleware, permission checks, nested
// server functions). Memoising per Request means each one costs one lookup, while a new
// request always re-reads the database, so revoked sessions and permissions are still seen.
const sessionsByRequest = new WeakMap<Request, Promise<SessionResult>>();
const permissionsByRequest = new WeakMap<Request, Promise<UserPermissions>>();

export function getRequestSession(): Promise<SessionResult> {
	const request = getRequest();
	if (!request?.headers) return Promise.resolve(null);

	let session = sessionsByRequest.get(request);
	if (!session) {
		// Bypass the signed cookie cache so revoked or expired sessions are detected.
		session = auth.api.getSession({
			headers: request.headers,
			query: { disableCookieCache: true },
		});
		sessionsByRequest.set(request, session);
	}
	return session;
}

function getRequestPermissions(request: Request, userId: string) {
	let permissions = permissionsByRequest.get(request);
	if (!permissions) {
		permissions = getUserPermissionsByUserId(userId);
		permissionsByRequest.set(request, permissions);
	}
	return permissions;
}

export async function getRequestAuthContext() {
	const request = getRequest();
	const userSession = await getRequestSession();
	if (!request || !userSession) return null;

	// Members have no staff permissions; skip the lookup on the portal and public pages.
	const { permissions, roles }: Pick<UserPermissions, "permissions" | "roles"> =
		userSession.user.role === "member"
			? { permissions: [], roles: [] }
			: await getRequestPermissions(request, userSession.user.id);

	return { user: userSession.user, session: userSession.session, permissions, roles };
}
