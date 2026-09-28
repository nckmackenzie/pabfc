import { describe, expect, it } from "vitest";
import {
	complimentaryRequestSchema,
	rejectComplimentaryRequestSchema,
} from "./complimentary.schemas";

describe("complimentaryRequestSchema", () => {
	const validInput = {
		memberId: "member-1",
		planId: "plan-1",
		startDate: "2026-10-01",
		numberOfPeriods: 1,
		reason: "Loyal member of 5 years, retention gesture",
	};

	it("accepts a fully valid request", () => {
		expect(complimentaryRequestSchema.safeParse(validInput).success).toBe(true);
	});

	it("rejects a reason shorter than 10 characters", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, reason: "too short" });
		expect(result.success).toBe(false);
	});

	it("rejects a non-integer numberOfPeriods", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, numberOfPeriods: 1.5 });
		expect(result.success).toBe(false);
	});

	it("rejects numberOfPeriods below 1", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, numberOfPeriods: 0 });
		expect(result.success).toBe(false);
	});

	it("rejects a missing planId", () => {
		const result = complimentaryRequestSchema.safeParse({ ...validInput, planId: "" });
		expect(result.success).toBe(false);
	});
});

describe("rejectComplimentaryRequestSchema", () => {
	it("accepts a rejection reason of at least 10 characters", () => {
		const result = rejectComplimentaryRequestSchema.safeParse({
			requestId: "req-1",
			rejectionReason: "Plan does not match retention policy",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a rejection reason shorter than 10 characters", () => {
		const result = rejectComplimentaryRequestSchema.safeParse({
			requestId: "req-1",
			rejectionReason: "too short",
		});
		expect(result.success).toBe(false);
	});
});
