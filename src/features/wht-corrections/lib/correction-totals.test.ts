import { describe, expect, it } from "vitest";
import { areJournalValuesBalanced } from "@/services/journal";
import {
	buildCorrectionJournalLines,
	sumCorrectionLines,
} from "@/features/wht-corrections/lib/correction-totals";

describe("sumCorrectionLines", () => {
	it("sums line amounts", () => {
		expect(sumCorrectionLines([{ amount: 100 }, { amount: 250.5 }])).toBe(
			350.5,
		);
	});

	it("rounds to the cent", () => {
		expect(
			sumCorrectionLines([{ amount: 100.111 }, { amount: 50.114 }]),
		).toBe(150.23);
	});

	it("is zero for no lines", () => {
		expect(sumCorrectionLines([])).toBe(0);
	});
});

describe("buildCorrectionJournalLines", () => {
	it("debits accounts_payable and credits the resolved account for the same total", () => {
		const lines = buildCorrectionJournalLines({
			debitAccountId: 42,
			creditAccountId: 17,
			total: 500,
			memo: "March catch-up",
		});

		expect(lines).toEqual([
			{
				accountId: 42,
				amount: "500",
				dc: "debit",
				lineNumber: 1,
				memo: "March catch-up",
			},
			{
				accountId: 17,
				amount: "500",
				dc: "credit",
				lineNumber: 2,
				memo: "March catch-up",
			},
		]);
	});

	it("always produces a balanced journal", () => {
		const lines = buildCorrectionJournalLines({
			debitAccountId: 1,
			creditAccountId: 2,
			total: 333.33,
			memo: null,
		});

		expect(areJournalValuesBalanced(lines)).toBe(true);
	});
});
