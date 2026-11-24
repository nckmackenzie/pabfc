import { describe, expect, it } from "vitest";
import { ENQUIRY_STATUSES } from "@/drizzle/schema";
import {
	allowedManualTransitions,
	canSystemTransition,
	canTransition,
	isConversionStatus,
	isOpenStatus,
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

describe("canSystemTransition", () => {
	it.each([
		["new", "registered"],
		["contacted", "registered"],
		["new", "converted"],
		["contacted", "converted"],
		["registered", "converted"],
		["converted", "registered"],
	] as const)("allows %s -> %s", (from, to) => {
		expect(canSystemTransition(from, to)).toBe(true);
	});

	it("never moves a lost enquiry", () => {
		for (const to of ENQUIRY_STATUSES) {
			expect(canSystemTransition("lost", to)).toBe(false);
		}
	});

	it("never produces new, contacted or lost", () => {
		for (const from of ENQUIRY_STATUSES) {
			for (const to of ["new", "contacted", "lost"] as const) {
				expect(canSystemTransition(from, to)).toBe(false);
			}
		}
	});

	it("does not allow no-ops, or registered going back to new", () => {
		expect(canSystemTransition("registered", "registered")).toBe(false);
		expect(canSystemTransition("converted", "converted")).toBe(false);
		expect(canSystemTransition("registered", "new")).toBe(false);
	});

	it("leaves the manual rules unchanged", () => {
		expect(canTransition("new", "registered")).toBe(false);
		expect(canTransition("registered", "converted")).toBe(false);
		expect(canTransition("converted", "registered")).toBe(false);
	});
});

describe("isOpenStatus", () => {
	it("is true only for new and contacted", () => {
		expect(ENQUIRY_STATUSES.filter(isOpenStatus)).toEqual(["new", "contacted"]);
	});
});
