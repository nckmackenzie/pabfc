import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { memberMemberships } from "@/drizzle/schema";
import { getDueMembershipConditions } from "./membership-activation";

describe("getDueMembershipConditions", () => {
	it("matches pending memberships whose start date is on or before today", () => {
		const query = drizzle
			.mock({ casing: "snake_case" })
			.select()
			.from(memberMemberships)
			.where(getDueMembershipConditions(new Date(2026, 8, 24, 9, 30)))
			.toSQL();
		const normalizedSql = query.sql.toLowerCase().replace(/\s+/g, " ");

		expect(normalizedSql).toContain('"member_memberships"."status" = $1');
		expect(normalizedSql).toContain('"member_memberships"."start_date" <= $2');
		expect(query.params).toEqual(["pending", "2026-09-24"]);
	});
});
