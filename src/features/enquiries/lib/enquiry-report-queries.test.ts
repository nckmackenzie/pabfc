import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { UNASSIGNED_FILTER } from "@/features/enquiries/lib/enquiry-report";
import {
	buildEnquiryReportQuery,
	type EnquiryReportFilters,
} from "@/features/enquiries/lib/enquiry-report-queries";

const qb = new QueryBuilder();
const RANGE = { from: "2026-11-01", to: "2026-11-30" };

function reportSql(filters: Partial<EnquiryReportFilters> = {}) {
	return buildEnquiryReportQuery(qb as never, { ...RANGE, ...filters }).toSQL();
}

describe("report query: deleted enquiries", () => {
	it("always excludes them", () => {
		expect(reportSql().sql).toContain('"enquiries"."deleted_at" is null');
		expect(
			reportSql({ sources: ["instagram"], assignedEmployeeId: UNASSIGNED_FILTER }).sql
		).toContain('"enquiries"."deleted_at" is null');
	});
});

describe("report query: Nairobi time zone", () => {
	const { sql, params } = reportSql();

	it("converts createdAt with AT TIME ZONE before comparing it to the range", () => {
		expect(sql).toContain('("enquiries"."created_at" AT TIME ZONE $');
		// The zone parameter is cast to text so Postgres can't read it as an interval.
		expect(sql).toMatch(/AT TIME ZONE \$\d+::text\)::date >= \$\d+::date/);
		expect(sql).toMatch(/AT TIME ZONE \$\d+::text\)::date <= \$\d+::date/);
	});

	it("converts convertedAt too, since it is a timestamptz", () => {
		expect(sql).toContain('("enquiries"."converted_at" AT TIME ZONE $');
	});

	it("binds the Nairobi zone and the range as parameters", () => {
		expect(params).toContain("Africa/Nairobi");
		expect(params).toContain("2026-11-01");
		expect(params).toContain("2026-11-30");
	});

	it("returns the days as text so they aren't turned into JS Dates", () => {
		expect(sql).toMatch(/"enquiries"\."created_at" AT TIME ZONE \$\d+::text\)::date::text/);
		expect(sql).toMatch(/"enquiries"\."converted_at" AT TIME ZONE \$\d+::text\)::date::text/);
	});
});

describe("report query: cohort and activity in one statement", () => {
	const { sql, params } = reportSql();

	it("takes enquiries created in the range OR currently converted with convertedAt in the range", () => {
		expect(sql).toMatch(/\) or \(/);
		expect(sql).toContain('"enquiries"."status" = $');
		expect(params).toContain("converted");
		expect(sql).toContain('"enquiries"."converted_at" is not null');
	});

	it("joins the converting payment for its total", () => {
		expect(sql).toContain(
			'left join "payments" on "payments"."id" = "enquiries"."converted_payment_id"'
		);
		expect(sql).toContain('"payments"."total_amount"');
	});

	it("joins the assigned employee for the staff breakdown", () => {
		expect(sql).toContain(
			'left join "employees" on "employees"."id" = "enquiries"."assigned_employee_id"'
		);
	});

	it("counts how many enquiries each payment converted, qualifying the outer column", () => {
		expect(sql).toContain('e2."converted_payment_id" = "enquiries"."converted_payment_id"');
		expect(sql).toContain('e2."deleted_at" is null');
	});

	it("flags direct registrations as converted with no registeredAt", () => {
		expect(sql).toContain(
			`"enquiries"."status" = 'converted' and "enquiries"."registered_at" is null`
		);
	});
});

describe("report query: source and staff filters", () => {
	it("adds nothing when no filters are given", () => {
		const { sql } = reportSql();
		expect(sql).not.toContain('"enquiries"."source" in');
		expect(sql).not.toContain('"enquiries"."assigned_employee_id" =');
		expect(sql).not.toContain('"enquiries"."assigned_employee_id" is null');
	});

	it("filters by any of the chosen sources", () => {
		const { sql, params } = reportSql({ sources: ["instagram", "walk_in"] });
		expect(sql).toContain('"enquiries"."source" in ($');
		expect(params).toEqual(expect.arrayContaining(["instagram", "walk_in"]));
	});

	it("ignores an empty source list", () => {
		expect(reportSql({ sources: [] }).sql).not.toContain('"enquiries"."source" in');
	});

	it("filters by an assigned employee", () => {
		const { sql, params } = reportSql({ assignedEmployeeId: "emp-1" });
		expect(sql).toContain('"enquiries"."assigned_employee_id" = $');
		expect(params).toContain("emp-1");
	});

	it("filters to unassigned enquiries", () => {
		const { sql, params } = reportSql({ assignedEmployeeId: UNASSIGNED_FILTER });
		expect(sql).toContain('"enquiries"."assigned_employee_id" is null');
		expect(params).not.toContain(UNASSIGNED_FILTER);
	});

	it("applies the filters to both measures (they sit outside the OR)", () => {
		const { sql } = reportSql({ sources: ["instagram"] });
		const sourceAt = sql.indexOf('"enquiries"."source" in');
		const orAt = sql.indexOf(") or (");
		expect(sourceAt).toBeGreaterThan(-1);
		expect(sourceAt).toBeLessThan(orAt);
	});
});
