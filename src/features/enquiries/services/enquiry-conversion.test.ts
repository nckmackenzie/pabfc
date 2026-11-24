import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { enquiries, payments } from "@/drizzle/schema";
import {
	type ConversionMemberInput,
	fallbackCandidateFilter,
	fallbackCandidateOrder,
	paidPaymentCoveringMemberFilter,
	planEnquiryConversions,
	planVoidReversal,
	registeredEnquiriesForMemberFilter,
} from "@/features/enquiries/services/enquiry-conversion";

const qb = new QueryBuilder();

const day = (d: number) => new Date(`2026-11-${String(d).padStart(2, "0")}T09:00:00Z`);

function member(overrides: Partial<ConversionMemberInput> = {}): ConversionMemberInput {
	return {
		memberId: "m1",
		priorPaidPaymentCount: 0,
		registeredEnquiries: [],
		fallbackCandidates: [],
		...overrides,
	};
}

describe("planEnquiryConversions", () => {
	it("converts a linked registered enquiry on the member's first payment", () => {
		expect(
			planEnquiryConversions([member({ registeredEnquiries: [{ id: "e1", createdAt: day(1) }] })])
		).toEqual([{ enquiryId: "e1", memberId: "m1", via: "registered" }]);
	});

	it("also converts a linked registered enquiry on a later payment (lapsed member linked)", () => {
		expect(
			planEnquiryConversions([
				member({
					priorPaidPaymentCount: 4,
					registeredEnquiries: [{ id: "e1", createdAt: day(1) }],
				}),
			])
		).toEqual([{ enquiryId: "e1", memberId: "m1", via: "registered" }]);
	});

	it("lets a registered link beat the phone fallback", () => {
		const planned = planEnquiryConversions([
			member({
				registeredEnquiries: [{ id: "linked", createdAt: day(1) }],
				fallbackCandidates: [{ id: "by-phone", createdAt: day(5) }],
			}),
		]);
		expect(planned).toEqual([{ enquiryId: "linked", memberId: "m1", via: "registered" }]);
	});

	it("converts every enquiry linked to the same member", () => {
		const planned = planEnquiryConversions([
			member({
				registeredEnquiries: [
					{ id: "e1", createdAt: day(1) },
					{ id: "e2", createdAt: day(2) },
				],
			}),
		]);
		expect(planned.map((p) => p.enquiryId)).toEqual(["e1", "e2"]);
	});

	it("falls back to an open enquiry matching the phone on a first payment", () => {
		expect(
			planEnquiryConversions([member({ fallbackCandidates: [{ id: "e1", createdAt: day(1) }] })])
		).toEqual([{ enquiryId: "e1", memberId: "m1", via: "fallback" }]);
	});

	it("picks the most recent candidate for the fallback", () => {
		const planned = planEnquiryConversions([
			member({
				fallbackCandidates: [
					{ id: "old", createdAt: day(1) },
					{ id: "newest", createdAt: day(9) },
					{ id: "middle", createdAt: day(4) },
				],
			}),
		]);
		expect(planned).toEqual([{ enquiryId: "newest", memberId: "m1", via: "fallback" }]);
	});

	it("does not use the fallback once the member has paid before", () => {
		expect(
			planEnquiryConversions([
				member({
					priorPaidPaymentCount: 1,
					fallbackCandidates: [{ id: "e1", createdAt: day(1) }],
				}),
			])
		).toEqual([]);
	});

	it("leaves nothing when there is no linked enquiry and no candidate", () => {
		expect(planEnquiryConversions([member()])).toEqual([]);
		expect(planEnquiryConversions([])).toEqual([]);
	});

	it("evaluates each member of a group payment separately", () => {
		const planned = planEnquiryConversions([
			member({ memberId: "billing", registeredEnquiries: [{ id: "e1", createdAt: day(1) }] }),
			member({ memberId: "friend", fallbackCandidates: [{ id: "e2", createdAt: day(2) }] }),
			member({
				memberId: "veteran",
				priorPaidPaymentCount: 3,
				fallbackCandidates: [{ id: "e3", createdAt: day(3) }],
			}),
			member({ memberId: "nobody" }),
		]);
		expect(planned).toEqual([
			{ enquiryId: "e1", memberId: "billing", via: "registered" },
			{ enquiryId: "e2", memberId: "friend", via: "fallback" },
		]);
	});

	it("never converts the same enquiry for two members", () => {
		const shared = { id: "shared", createdAt: day(1) };
		const planned = planEnquiryConversions([
			member({ memberId: "a", fallbackCandidates: [shared] }),
			member({ memberId: "b", fallbackCandidates: [shared] }),
		]);
		expect(planned).toEqual([{ enquiryId: "shared", memberId: "a", via: "fallback" }]);
	});
});

describe("planVoidReversal", () => {
	it("returns to registered and clears the payment link", () => {
		expect(planVoidReversal({ registeredAt: day(2), convertedAt: day(8) })).toEqual({
			status: "registered",
			convertedPaymentId: null,
			convertedAt: null,
			registeredAt: day(2),
		});
	});

	it("uses convertedAt as registeredAt for a directly registered (fallback) enquiry", () => {
		expect(planVoidReversal({ registeredAt: null, convertedAt: day(8) }).registeredAt).toEqual(
			day(8)
		);
	});

	it("never touches the member link", () => {
		expect(planVoidReversal({ registeredAt: null, convertedAt: null })).not.toHaveProperty(
			"convertedMemberId"
		);
	});
});

describe("paidPaymentCoveringMemberFilter", () => {
	const { sql, params } = qb
		.select({ id: payments.id })
		.from(payments)
		.where(paidPaymentCoveringMemberFilter({ memberId: "m1", excludePaymentId: "p-now" }))
		.toSQL();

	it("counts only completed payments, so voided and pending ones are ignored", () => {
		expect(sql).toContain('"payments"."status" = $1');
		expect(params[0]).toBe("completed");
	});

	it("ignores complimentary payments", () => {
		expect(sql).toContain('"payments"."method" <> $2');
		expect(params[1]).toBe("complimentary");
	});

	it("excludes the payment being finalised", () => {
		expect(sql).toContain('"payments"."id" <> $3');
		expect(params[2]).toBe("p-now");
	});

	it("matches coverage through payment_members", () => {
		expect(sql).toContain('exists (select "id" from "payment_members"');
		expect(sql).toContain('"payment_members"."member_id" = $4');
		expect(params[3]).toBe("m1");
	});

	it("trusts payments.memberId only when the payment has no payment_members rows (STK)", () => {
		expect(sql).toContain('"payments"."member_id" = $5');
		expect(sql).toContain('not exists (select "id" from "payment_members"');
		expect(params[4]).toBe("m1");
	});
});

describe("fallback and registered lookups", () => {
	it("matches open, non-deleted enquiries on every phone format, newest first", () => {
		const { sql, params } = qb
			.select({ id: enquiries.id })
			.from(enquiries)
			.where(fallbackCandidateFilter("0712345678"))
			.orderBy(fallbackCandidateOrder)
			.toSQL();

		expect(sql).toContain('"enquiries"."phone" in ($1, $2, $3, $4)');
		expect(sql).toContain('"enquiries"."status" in ($5, $6)');
		expect(sql).toContain('"enquiries"."deleted_at" is null');
		expect(sql).toContain('order by "enquiries"."created_at" desc');
		expect(params).toEqual([
			"+254712345678",
			"0712345678",
			"254712345678",
			"712345678",
			"new",
			"contacted",
		]);
	});

	it("matches a member stored as +254 against the same variants", () => {
		const { params } = qb
			.select({ id: enquiries.id })
			.from(enquiries)
			.where(fallbackCandidateFilter("+254712345678"))
			.toSQL();
		expect(params.slice(0, 4)).toContain("0712345678");
	});

	it("has no fallback filter for an unparseable contact", () => {
		expect(fallbackCandidateFilter("not a phone")).toBeUndefined();
	});

	it("finds registered, non-deleted enquiries linked to the member", () => {
		const { sql, params } = qb
			.select({ id: enquiries.id })
			.from(enquiries)
			.where(registeredEnquiriesForMemberFilter("m1"))
			.toSQL();

		expect(sql).toContain('"enquiries"."converted_member_id" = $1');
		expect(sql).toContain('"enquiries"."status" = $2');
		expect(sql).toContain('"enquiries"."deleted_at" is null');
		expect(params).toEqual(["m1", "registered"]);
	});
});
