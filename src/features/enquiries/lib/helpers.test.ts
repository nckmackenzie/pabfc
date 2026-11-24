import { describe, expect, it } from "vitest";
import {
	enquiryFullName,
	normalizeEnquiryValues,
	resolveSmsConsentAt,
} from "@/features/enquiries/lib/helpers";

describe("normalizeEnquiryValues", () => {
	it("trims, nulls empty strings and canonicalises the phone", () => {
		expect(
			normalizeEnquiryValues({
				firstName: "  Jane ",
				lastName: "   ",
				phone: "0712 345 678",
				email: " Jane@Example.com ",
				sourceNotes: "",
				notes: " asked about yoga ",
				interestedPlanId: "",
				assignedEmployeeId: null,
				followUpDate: "",
			})
		).toEqual({
			firstName: "Jane",
			lastName: null,
			phone: "+254712345678",
			email: "jane@example.com",
			sourceNotes: null,
			notes: "asked about yoga",
			interestedPlanId: null,
			assignedEmployeeId: null,
			followUpDate: null,
		});
	});

	it("returns a null phone when it is invalid", () => {
		expect(normalizeEnquiryValues({ firstName: "A", phone: "123" }).phone).toBeNull();
	});
});

describe("enquiryFullName", () => {
	it("joins the names it has", () => {
		expect(enquiryFullName("Jane", "Doe")).toBe("Jane Doe");
		expect(enquiryFullName("Jane", null)).toBe("Jane");
		expect(enquiryFullName(" Jane ", " ")).toBe("Jane");
	});
});

describe("resolveSmsConsentAt", () => {
	const now = new Date("2026-11-23T10:00:00Z");
	const earlier = new Date("2026-11-01T08:00:00Z");

	it("stamps the time when consent is first ticked", () => {
		expect(resolveSmsConsentAt({ consent: true, now })).toEqual(now);
		expect(
			resolveSmsConsentAt({
				consent: true,
				existing: { smsConsent: false, smsConsentAt: null },
				now,
			})
		).toEqual(now);
	});

	it("keeps the original time while consent stays ticked", () => {
		expect(
			resolveSmsConsentAt({
				consent: true,
				existing: { smsConsent: true, smsConsentAt: earlier },
				now,
			})
		).toEqual(earlier);
	});

	it("clears the time when consent is unticked", () => {
		expect(
			resolveSmsConsentAt({
				consent: false,
				existing: { smsConsent: true, smsConsentAt: earlier },
				now,
			})
		).toBeNull();
	});
});
