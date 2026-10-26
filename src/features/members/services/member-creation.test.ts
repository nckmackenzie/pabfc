import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/drizzle/db", () => ({ db: {} }));

import * as schema from "@/drizzle/schema";
import {
	buildNewMemberProfileValues,
	buildNewMemberValues,
	mapMemberData,
} from "@/features/members/services/member-creation";
import type { MemberFormSchema } from "@/features/members/services/schemas";

const mockDb = drizzle.mock({ schema });

const formData = {
	firstName: "Jane",
	lastName: "Doe",
	contact: "0712345678",
	gender: "female",
	memberStatus: "active",
} as MemberFormSchema;

describe("member registration", () => {
	it("inserts the member as inactive even when the form says active", () => {
		const values = buildNewMemberValues(mapMemberData(formData), 1042);
		const { sql, params } = mockDb.insert(schema.members).values(values).toSQL();

		expect(values.memberStatus).toBe("inactive");
		expect(sql).toContain('"member_status"');
		expect(params).toContain("inactive");
		expect(params).not.toContain("active");
	});

	it("creates the BioTime profile with access off", () => {
		const values = buildNewMemberProfileValues({
			memberId: "m1",
			empCode: "M001042",
			payload: {},
			authorizedAreaId: 5,
			unauthorizedAreaId: 4,
		});
		const { sql, params } = mockDb.insert(schema.biotimePersonProfiles).values(values).toSQL();

		expect(values.desiredAccessEnabled).toBe(false);
		expect(values.authorizedAreaId).toBe(5);
		expect(values.unauthorizedAreaId).toBe(4);
		expect(sql).toContain('"desired_access_enabled"');
		expect(params).toContain(false);
		expect(params).not.toContain(true);
	});
});
