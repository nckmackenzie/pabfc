import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { membershipSessionUsage } from "@/drizzle/schema";
import { activeSessionUsageCondition } from "./void";

// checkVoidEligibility itself needs a live tx/db (no DB-backed tests exist in
// this codebase — see AGENTS.md), so this only pins down the exact query shape
// the session guard must issue, the same way membership-activation.test.ts pins
// getDueMembershipConditions's SQL without a real connection.
describe("session usage existence query shape", () => {
	const query = drizzle
		.mock({ casing: "snake_case" })
		.select({ id: membershipSessionUsage.id })
		.from(membershipSessionUsage)
		.where(activeSessionUsageCondition("m1"))
		.toSQL();
	const normalizedSql = query.sql.toLowerCase().replace(/\s+/g, " ");

	it("filters by membershipId", () => {
		expect(normalizedSql).toContain('"membership_session_usage"."membership_id" = $1');
		expect(query.params).toEqual(["m1"]);
	});

	it("ignores voided usage rows so only a non-voided row blocks the void", () => {
		expect(normalizedSql).toContain('"membership_session_usage"."voided_at" is null');
	});
});
