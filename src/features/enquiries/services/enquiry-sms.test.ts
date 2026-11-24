import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { type EnquiryStatus, enquiries } from "@/drizzle/schema";
import { replaceVariables } from "@/features/communication/lib/utils";
import {
	buildEnquiryTemplateData,
	classifyEnquiryRecipients,
	eligibleEnquirySmsFilter,
	enquirySmsCandidateFilter,
	resolveEnquiryRecipients,
	summarizeEnquirySmsFilters,
} from "@/features/enquiries/services/enquiry-sms";

const qb = new QueryBuilder();
const TODAY = "2026-11-24";

function row(
	id: string,
	overrides: Partial<{
		smsConsent: boolean;
		status: EnquiryStatus;
		phone: string;
		firstName: string;
		lastName: string | null;
	}> = {}
) {
	return {
		id,
		firstName: "Jane",
		lastName: "Doe",
		phone: "+254712345678",
		smsConsent: true,
		status: "new" as EnquiryStatus,
		...overrides,
	};
}

describe("classifyEnquiryRecipients", () => {
	it("makes consented enquirers in every eligible status eligible", () => {
		const { eligible, excluded } = classifyEnquiryRecipients([
			row("a", { status: "new" }),
			row("b", { status: "contacted" }),
			row("c", { status: "registered" }),
			row("d", { status: "lost" }),
		]);
		expect(eligible.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
		expect(excluded).toEqual({ noConsent: 0, ineligibleStatus: 0, invalidPhone: 0, notFound: 0 });
	});

	it("excludes converted enquirers: they are members and get member broadcasts", () => {
		const { eligible, excluded } = classifyEnquiryRecipients([row("a", { status: "converted" })]);
		expect(eligible).toEqual([]);
		expect(excluded.ineligibleStatus).toBe(1);
	});

	it("excludes anyone without SMS consent", () => {
		const { eligible, excluded } = classifyEnquiryRecipients([
			row("yes"),
			row("no", { smsConsent: false }),
		]);
		expect(eligible.map((r) => r.id)).toEqual(["yes"]);
		expect(excluded.noConsent).toBe(1);
	});

	it("excludes invalid phone numbers", () => {
		const { eligible, excluded } = classifyEnquiryRecipients([
			row("bad", { phone: "12345" }),
			row("foreign", { phone: "+255712345678" }),
			row("ok"),
		]);
		expect(eligible.map((r) => r.id)).toEqual(["ok"]);
		expect(excluded.invalidPhone).toBe(2);
	});

	it("normalises a phone that isn't already canonical", () => {
		const { eligible } = classifyEnquiryRecipients([row("a", { phone: "0712 345 678" })]);
		expect(eligible[0].phone).toBe("+254712345678");
	});

	it("counts each person once, under the first rule they fail", () => {
		const { excluded } = classifyEnquiryRecipients([
			// converted AND no consent AND bad phone: counted as ineligible status only
			row("a", { status: "converted", smsConsent: false, phone: "x" }),
			// no consent AND bad phone: counted as no consent only
			row("b", { smsConsent: false, phone: "x" }),
		]);
		expect(excluded).toEqual({ noConsent: 1, ineligibleStatus: 1, invalidPhone: 0, notFound: 0 });
	});

	it("reports requested IDs that no longer exist", () => {
		const { excluded } = classifyEnquiryRecipients([row("a")], ["a", "gone", "gone-too", "a"]);
		expect(excluded.notFound).toBe(2);
	});

	it("does not report missing IDs when resolving by filters", () => {
		expect(classifyEnquiryRecipients([row("a")]).excluded.notFound).toBe(0);
	});
});

describe("buildEnquiryTemplateData", () => {
	it("title-cases the names", () => {
		expect(buildEnquiryTemplateData({ firstName: "JANE", lastName: "van DAM" })).toEqual({
			firstName: "Jane",
			lastName: "Van Dam",
		});
	});

	it("turns a null last name into an empty string, never 'null'", () => {
		const data = buildEnquiryTemplateData({ firstName: "Jane", lastName: null });
		expect(data.lastName).toBe("");
		expect(replaceVariables("Hi {firstName}{lastName}, welcome", data)).toBe("Hi Jane, welcome");
		expect(replaceVariables("Hi {firstName} {lastName}!", data)).not.toContain("null");
	});

	it("fills both variables in a template", () => {
		const data = buildEnquiryTemplateData({ firstName: "jane", lastName: "doe" });
		expect(replaceVariables("Hello {firstName} {lastName}", data)).toBe("Hello Jane Doe");
	});
});

describe("enquirySmsCandidateFilter", () => {
	function sqlFor(input: Parameters<typeof enquirySmsCandidateFilter>[0]) {
		return qb
			.select({ id: enquiries.id })
			.from(enquiries)
			.where(enquirySmsCandidateFilter(input, TODAY))
			.toSQL();
	}

	it("targets specific IDs, de-duplicated, and never deleted enquiries", () => {
		const { sql, params } = sqlFor({ enquiryIds: ["a", "b", "a"] });
		expect(sql).toContain('"enquiries"."deleted_at" is null');
		expect(sql).toContain('"enquiries"."id" in ($1, $2)');
		expect(params).toEqual(["a", "b"]);
	});

	it("targets the list filters when no IDs are given", () => {
		const { sql, params } = sqlFor({ filters: { status: "contacted", source: "instagram" } });
		expect(sql).toContain('"enquiries"."deleted_at" is null');
		expect(sql).toContain('"enquiries"."status" = $1');
		expect(sql).toContain('"enquiries"."source" = $2');
		expect(params).toEqual(["contacted", "instagram"]);
	});

	it("applies the follow-up filter relative to today", () => {
		const { params } = sqlFor({ filters: { followUp: "overdue" } });
		expect(params).toContain(TODAY);
	});

	it("never lets an empty ID list fall through to everyone", () => {
		const { sql } = sqlFor({ enquiryIds: [] });
		expect(sql).toContain("where false");
	});

	it("IDs win over filters", () => {
		const { sql } = sqlFor({ enquiryIds: ["a"], filters: { status: "lost" } });
		expect(sql).toContain('"enquiries"."id" in ($1)');
		expect(sql).not.toContain('"enquiries"."status" =');
	});
});

describe("eligibleEnquirySmsFilter (the send-time re-check)", () => {
	const { sql, params } = qb
		.select({ id: enquiries.id })
		.from(enquiries)
		.where(eligibleEnquirySmsFilter())
		.toSQL();

	it("requires consent", () => {
		expect(sql).toContain('"enquiries"."sms_consent" = $1');
		expect(params[0]).toBe(true);
	});

	it("excludes deleted enquiries", () => {
		expect(sql).toContain('"enquiries"."deleted_at" is null');
	});

	it("allows only new, contacted, registered and lost", () => {
		expect(sql).toContain('"enquiries"."status" in ($2, $3, $4, $5)');
		expect(params.slice(1)).toEqual(["new", "contacted", "registered", "lost"]);
		expect(params).not.toContain("converted");
	});
});

describe("resolveEnquiryRecipients", () => {
	// A stand-in for the db: records the WHERE and returns canned rows.
	function fakeExecutor(rows: ReturnType<typeof row>[]) {
		const captured: { where?: Parameters<ReturnType<typeof qb.select>["from"]> | unknown } = {};
		const executor = {
			select: () => ({
				from: () => ({
					where: (condition: unknown) => {
						captured.where = condition;
						return Promise.resolve(rows);
					},
				}),
			}),
		};
		return { executor: executor as never, captured };
	}

	it("classifies whatever the query returns", async () => {
		const { executor } = fakeExecutor([
			row("a"),
			row("b", { smsConsent: false }),
			row("c", { status: "converted" }),
		]);
		const result = await resolveEnquiryRecipients(executor, { enquiryIds: ["a", "b", "c"] });
		expect(result.eligible.map((r) => r.id)).toEqual(["a"]);
		expect(result.excluded).toMatchObject({ noConsent: 1, ineligibleStatus: 1, notFound: 0 });
	});

	it("flags requested IDs the query didn't return", async () => {
		const { executor } = fakeExecutor([row("a")]);
		const result = await resolveEnquiryRecipients(executor, { enquiryIds: ["a", "deleted"] });
		expect(result.excluded.notFound).toBe(1);
	});

	it("queries by the candidate filter", async () => {
		const { executor, captured } = fakeExecutor([]);
		await resolveEnquiryRecipients(executor, { enquiryIds: ["a"] });
		const { sql, params } = qb
			.select({ id: enquiries.id })
			.from(enquiries)
			.where(captured.where as never)
			.toSQL();
		expect(sql).toContain('"enquiries"."id" in ($1)');
		expect(params).toEqual(["a"]);
	});
});

describe("summarizeEnquirySmsFilters", () => {
	it("keeps only the filters that narrow the list", () => {
		expect(
			summarizeEnquirySmsFilters({
				q: "",
				status: "all",
				source: "instagram",
				assignedEmployeeId: "all",
				followUp: "overdue",
				from: "2026-11-01",
				to: "2026-11-30",
			})
		).toEqual({ source: "instagram", followUp: "overdue", from: "2026-11-01", to: "2026-11-30" });
	});

	it("is empty when nothing is applied", () => {
		expect(summarizeEnquirySmsFilters({ status: "all", q: "" })).toEqual({});
		expect(summarizeEnquirySmsFilters({})).toEqual({});
	});
});
