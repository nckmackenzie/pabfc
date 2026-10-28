import { describe, expect, it } from "vitest";
import { can, canAny, type AuthContext } from "./can";

const staff = {
	user: { role: "staff" },
	permissions: ["members:view"],
} as NonNullable<AuthContext>;

describe("client permission checks", () => {
	it("uses the cached permissions for staff", () => {
		expect(can(staff, "members:view")).toBe(true);
		expect(can(staff, "members:delete")).toBe(false);
		expect(canAny(staff, ["members:delete", "members:view"])).toBe(true);
	});

	it("preserves admin access and rejects missing auth", () => {
		expect(can({ ...staff, user: { ...staff.user, role: "admin" } }, "members:delete")).toBe(true);
		expect(can(null, "members:view")).toBe(false);
	});
});
