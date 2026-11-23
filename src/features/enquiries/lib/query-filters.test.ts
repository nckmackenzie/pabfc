import { and } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { enquiries, members } from "@/drizzle/schema";
import {
	buildEnquiryFilters,
	followUpFilter,
	memberByPhoneFilter,
	nairobiDayBounds,
	openEnquiryByPhoneFilter,
} from "@/features/enquiries/lib/query-filters";

const qb = new QueryBuilder();
const TODAY = "2026-11-23";

function listQuery(filters: Parameters<typeof buildEnquiryFilters>[0]) {
	return qb
		.select({ id: enquiries.id })
		.from(enquiries)
		.where(and(...buildEnquiryFilters(filters, TODAY)))
		.toSQL();
}

describe("followUpFilter", () => {
	function query(followUp: Parameters<typeof followUpFilter>[0]) {
		return qb.select().from(enquiries).where(followUpFilter(followUp, TODAY)).toSQL();
	}

	it("overdue means before today, for open enquiries only", () => {
		const { sql, params } = query("overdue");
		expect(sql).toContain('"enquiries"."follow_up_date" < $');
		expect(sql).toContain('"enquiries"."status" in ($');
		expect(params).toEqual(["new", "contacted", TODAY]);
	});

	it("today means exactly today", () => {
		const { sql, params } = query("today");
		expect(sql).toContain('"enquiries"."follow_up_date" = $');
		expect(params).toEqual(["new", "contacted", TODAY]);
	});

	it("upcoming means after today", () => {
		const { sql, params } = query("upcoming");
		expect(sql).toContain('"enquiries"."follow_up_date" > $');
		expect(params).toEqual(["new", "contacted", TODAY]);
	});

	it("adds nothing for all or undefined", () => {
		expect(followUpFilter("all", TODAY)).toBeUndefined();
		expect(followUpFilter(undefined, TODAY)).toBeUndefined();
	});
});

describe("buildEnquiryFilters", () => {
	it("always excludes deleted enquiries", () => {
		const { sql } = listQuery({});
		expect(sql).toContain('"enquiries"."deleted_at" is null');
	});

	it("applies status, source and assigned employee filters, ignoring all", () => {
		const { sql, params } = listQuery({
			status: "contacted",
			source: "instagram",
			assignedEmployeeId: "emp-1",
		});
		expect(sql).toContain('"enquiries"."status" = $');
		expect(sql).toContain('"enquiries"."source" = $');
		expect(sql).toContain('"enquiries"."assigned_employee_id" = $');
		expect(params).toEqual(["contacted", "instagram", "emp-1"]);

		const all = listQuery({ status: "all", source: "all", assignedEmployeeId: "all" });
		expect(all.params).toEqual([]);
	});

	it("combines the follow-up filter with the others", () => {
		const { sql, params } = listQuery({ followUp: "overdue", source: "walk_in" });
		expect(sql).toContain('"enquiries"."follow_up_date" < $');
		expect(params).toEqual(["walk_in", "new", "contacted", TODAY]);
	});

	it("bounds createdAt to whole Nairobi days", () => {
		const { sql, params } = listQuery({ from: "2026-11-01", to: "2026-11-30" });
		expect(sql).toContain('"enquiries"."created_at" >= $');
		expect(sql).toContain('"enquiries"."created_at" <= $');
		// 00:00 and 23:59:59.999 Nairobi (UTC+3), serialised by toSQL().
		expect(params).toEqual(["2026-10-31T21:00:00.000Z", "2026-11-30T20:59:59.999Z"]);
	});

	it("matches a typed local phone against the canonical stored one", () => {
		const { sql, params } = listQuery({ q: "0712 345 678" });
		expect(sql).toContain('"enquiries"."phone" = $');
		expect(params).toContain("+254712345678");
	});

	it("matches a partial number without its leading zero", () => {
		const { params } = listQuery({ q: "0712" });
		expect(params).toContain("%712%");
	});
});

describe("nairobiDayBounds", () => {
	it("returns undefined for missing ends", () => {
		expect(nairobiDayBounds({})).toEqual({ start: undefined, end: undefined });
	});
});

describe("duplicate lookups", () => {
	it("matches open enquiries on every phone variant, excluding the one being edited", () => {
		const { sql, params } = qb
			.select()
			.from(enquiries)
			.where(openEnquiryByPhoneFilter("0712345678", "enq-1"))
			.toSQL();

		expect(sql).toContain('"enquiries"."phone" in ($1, $2, $3, $4)');
		expect(sql).toContain('"enquiries"."status" in ($5, $6)');
		expect(sql).toContain('"enquiries"."deleted_at" is null');
		expect(sql).toContain('"enquiries"."id" <> $7');
		expect(params).toEqual([
			"+254712345678",
			"0712345678",
			"254712345678",
			"712345678",
			"new",
			"contacted",
			"enq-1",
		]);
	});

	it("matches members in every stored format without filtering out deleted ones", () => {
		const { sql, params } = qb
			.select()
			.from(members)
			.where(memberByPhoneFilter("+254 712 345 678"))
			.toSQL();

		expect(sql).toContain('"members"."contact" in ($1, $2, $3, $4)');
		// Only the WHERE clause matters: the column list legitimately names deleted_at.
		expect(sql.split(" where ")[1]).not.toContain("deleted_at");
		expect(params).toEqual(["+254712345678", "0712345678", "254712345678", "712345678"]);
	});

	it("returns no filter for an invalid phone", () => {
		expect(openEnquiryByPhoneFilter("123")).toBeUndefined();
		expect(memberByPhoneFilter("123")).toBeUndefined();
	});
});
