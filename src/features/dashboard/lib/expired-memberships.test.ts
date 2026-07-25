import { and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { memberMemberships } from "@/drizzle/schema";
import { getExpiredMembershipConditions } from "./expired-memberships";

describe("getExpiredMembershipConditions", () => {
	it("excludes only later active or pending memberships", () => {
		const query = drizzle
			.mock({ casing: "snake_case" })
			.select()
			.from(memberMemberships)
			.where(and(...getExpiredMembershipConditions(new Date("2026-07-25T09:30:00.000Z"))))
			.toSQL();
		const normalizedSql = query.sql.toLowerCase().replace(/\s+/g, " ");

		expect(normalizedSql).toContain("not exists");
		expect(normalizedSql).toContain('mm_newer.start_date > "member_memberships"."start_date"');
		expect(normalizedSql).toContain("mm_newer.status in");
		expect(query.params).toEqual(
			expect.arrayContaining(["2026-06-25", "2026-07-25", "expired", "active", "pending"])
		);
		expect(query.params).not.toEqual(expect.arrayContaining(["cancelled", "terminated"]));
	});
});
