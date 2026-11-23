import { describe, expect, it } from "vitest";
import { ENQUIRY_STATUSES } from "@/drizzle/schema";
import {
	allowedManualTransitions,
	canTransition,
	isConversionStatus,
} from "@/features/enquiries/lib/enquiry-status";

describe("allowedManualTransitions", () => {
	it("lets a new enquiry be contacted or lost", () => {
		expect(allowedManualTransitions("new")).toEqual(["contacted", "lost"]);
	});

	it("lets a contacted enquiry be lost", () => {
		expect(allowedManualTransitions("contacted")).toEqual(["lost"]);
	});

	it("lets a lost enquiry be reopened to contacted", () => {
		expect(allowedManualTransitions("lost")).toEqual(["contacted"]);
	});

	it("allows no manual moves out of registered or converted", () => {
		expect(allowedManualTransitions("registered")).toEqual([]);
		expect(allowedManualTransitions("converted")).toEqual([]);
	});
});

describe("canTransition", () => {
	it("matches allowedManualTransitions for every pair", () => {
		for (const from of ENQUIRY_STATUSES) {
			for (const to of ENQUIRY_STATUSES) {
				expect(canTransition(from, to)).toBe(allowedManualTransitions(from).includes(to));
			}
		}
	});

	it("never allows setting registered or converted manually", () => {
		for (const from of ENQUIRY_STATUSES) {
			expect(canTransition(from, "registered")).toBe(false);
			expect(canTransition(from, "converted")).toBe(false);
		}
	});

	it("does not allow a no-op or going back to new", () => {
		expect(canTransition("new", "new")).toBe(false);
		expect(canTransition("contacted", "new")).toBe(false);
		expect(canTransition("lost", "new")).toBe(false);
		expect(canTransition("contacted", "contacted")).toBe(false);
	});
});

describe("isConversionStatus", () => {
	it("is true only for registered and converted", () => {
		expect(ENQUIRY_STATUSES.filter(isConversionStatus)).toEqual(["registered", "converted"]);
	});
});
