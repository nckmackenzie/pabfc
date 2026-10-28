import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getPermissions = vi.fn();
let currentRequest: Request | undefined;

vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => currentRequest }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/permissions/permission-queries", () => ({
	getUserPermissionsByUserId: getPermissions,
}));

const { getRequestAuthContext } = await import("./request-auth");

const staff = { user: { id: "u1", role: "user" }, session: { id: "s1" } };

describe("getRequestAuthContext", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		currentRequest = new Request("http://localhost/");
		getSession.mockResolvedValue(staff);
		getPermissions.mockResolvedValue({ userId: "u1", permissions: ["a:view"], roles: ["r"] });
	});

	it("queries the session and permissions once per request", async () => {
		await Promise.all([getRequestAuthContext(), getRequestAuthContext()]);
		await getRequestAuthContext();
		expect(getSession).toHaveBeenCalledTimes(1);
		expect(getPermissions).toHaveBeenCalledTimes(1);
	});

	it("re-reads on a new request", async () => {
		await getRequestAuthContext();
		currentRequest = new Request("http://localhost/");
		await getRequestAuthContext();
		expect(getSession).toHaveBeenCalledTimes(2);
		expect(getPermissions).toHaveBeenCalledTimes(2);
	});

	it("skips permissions for members and returns null without a session", async () => {
		getSession.mockResolvedValueOnce({ ...staff, user: { id: "m1", role: "member" } });
		expect((await getRequestAuthContext())?.permissions).toEqual([]);
		expect(getPermissions).not.toHaveBeenCalled();

		currentRequest = new Request("http://localhost/");
		getSession.mockResolvedValueOnce(null);
		expect(await getRequestAuthContext()).toBeNull();
	});

	it("propagates permission lookup failures", async () => {
		getPermissions.mockRejectedValueOnce(new Error("db down"));
		await expect(getRequestAuthContext()).rejects.toThrow("db down");
	});
});
