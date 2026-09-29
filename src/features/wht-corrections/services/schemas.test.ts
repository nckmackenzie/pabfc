import { describe, expect, it } from "vitest";
import { correctionFormSchema } from "@/features/wht-corrections/services/schemas";

const baseLine = {
	billId: "bill_1",
	whtCategory: "professional_management_training_fee" as const,
	whtRate: 5,
	amount: 500,
};

const basePending = {
	correctionNo: "1",
	correctionDate: "2026-09-29",
	treatmentAccountId: "42",
	remittanceStatus: "pending" as const,
	remittanceDate: null,
	paymentMethod: null,
	bankId: null,
	cashEquivalentAccountId: null,
	memo: null,
	lines: [baseLine],
};

describe("correctionFormSchema", () => {
	it("accepts a pending correction with no remittance fields", () => {
		const result = correctionFormSchema.safeParse(basePending);
		expect(result.success).toBe(true);
	});

	it("requires at least one line", () => {
		const result = correctionFormSchema.safeParse({ ...basePending, lines: [] });
		expect(result.success).toBe(false);
	});

	it("rejects an already_remitted correction with no remittance date", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			paymentMethod: "bank",
			bankId: "bank_1",
		});
		expect(result.success).toBe(false);
	});

	it("rejects bank/cheque with no bank selected", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "cheque",
		});
		expect(result.success).toBe(false);
	});

	it("rejects cash/mpesa with no cash-equivalent account selected", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "mpesa",
		});
		expect(result.success).toBe(false);
	});

	it("accepts already_remitted paid via mpesa with a cash-equivalent account", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "mpesa",
			cashEquivalentAccountId: "17",
		});
		expect(result.success).toBe(true);
	});

	it("accepts already_remitted paid via bank with a bank selected", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			remittanceStatus: "already_remitted",
			remittanceDate: "2026-09-01",
			paymentMethod: "bank",
			bankId: "bank_1",
		});
		expect(result.success).toBe(true);
	});

	it("rejects the same bill referenced twice in one submission", () => {
		const result = correctionFormSchema.safeParse({
			...basePending,
			lines: [baseLine, { ...baseLine, amount: 100 }],
		});
		expect(result.success).toBe(false);
	});
});
