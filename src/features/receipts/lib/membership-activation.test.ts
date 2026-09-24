import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { memberMemberships } from "@/drizzle/schema";
import {
	getDueMembershipConditions,
	getMemberIdsWithCurrentMemberships,
} from "./membership-activation";

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

describe("getMemberIdsWithCurrentMemberships", () => {
	const today = new Date(2026, 8, 24, 9, 30);

	it("keeps memberships ending today, later, or open-ended", () => {
		expect(
			getMemberIdsWithCurrentMemberships(
				[
					{ memberId: "ends-today", endDate: "2026-09-24" },
					{ memberId: "ends-later", endDate: "2026-10-23" },
					{ memberId: "open-ended", endDate: null },
				],
				today
			)
		).toEqual(["ends-today", "ends-later", "open-ended"]);
	});

	it("drops memberships that already ended and de-duplicates members", () => {
		expect(
			getMemberIdsWithCurrentMemberships(
				[
					{ memberId: "ended", endDate: "2026-09-23" },
					{ memberId: "twice", endDate: "2026-10-01" },
					{ memberId: "twice", endDate: "2026-11-01" },
				],
				today
			)
		).toEqual(["twice"]);
	});
});
