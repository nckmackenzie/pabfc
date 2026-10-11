import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { membershipSessionUsage } from "@/drizzle/schema";

// checkVoidEligibility itself needs a live tx/db (no DB-backed tests exist in
// this codebase — see AGENTS.md), so this only pins down the exact query shape
// the new guard must issue, the same way membership-activation.test.ts pins
// getDueMembershipConditions's SQL without a real connection.
describe("session usage existence query shape", () => {
	it("filters membership_session_usage by membershipId only (voided rows included)", () => {
		const query = drizzle
			.mock({ casing: "snake_case" })
			.select({ id: membershipSessionUsage.id })
			.from(membershipSessionUsage)
			.where(eq(membershipSessionUsage.membershipId, "m1"))
			.toSQL();
		const normalizedSql = query.sql.toLowerCase().replace(/\s+/g, " ");
		expect(normalizedSql).toContain('"membership_session_usage"."membership_id" = $1');
		expect(normalizedSql).not.toContain("voided_at");
		expect(query.params).toEqual(["m1"]);
	});
});
