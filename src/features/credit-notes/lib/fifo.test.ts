import { describe, expect, it } from "vitest";
import { allocateCreditFifo } from "./fifo";

describe("allocateCreditFifo", () => {
	it("draws fully from the first (soonest-expiring) candidate when it covers the amount", () => {
		const allocations = allocateCreditFifo(
			[
				{ id: "cn-1", balanceRemaining: "500.00" },
				{ id: "cn-2", balanceRemaining: "300.00" },
			],
			"200.00"
		);
		expect(allocations).toEqual([{ creditNoteId: "cn-1", amountToApply: "200.00" }]);
	});

	it("draws from multiple credit notes in order when one isn't enough", () => {
		const allocations = allocateCreditFifo(
			[
				{ id: "cn-1", balanceRemaining: "150.00" },
				{ id: "cn-2", balanceRemaining: "300.00" },
			],
			"400.00"
		);
		expect(allocations).toEqual([
			{ creditNoteId: "cn-1", amountToApply: "150.00" },
			{ creditNoteId: "cn-2", amountToApply: "250.00" },
		]);
	});

	it("stops once the amount needed is fully funded, leaving later candidates untouched", () => {
		const allocations = allocateCreditFifo(
			[
				{ id: "cn-1", balanceRemaining: "150.00" },
				{ id: "cn-2", balanceRemaining: "300.00" },
				{ id: "cn-3", balanceRemaining: "300.00" },
			],
			"200.00"
		);
		expect(allocations.map((a) => a.creditNoteId)).toEqual(["cn-1", "cn-2"]);
		expect(allocations[1].amountToApply).toBe("50.00");
	});

	it("allocates only what's available when candidates are exhausted before the amount is fully funded", () => {
		const allocations = allocateCreditFifo(
			[
				{ id: "cn-1", balanceRemaining: "100.00" },
				{ id: "cn-2", balanceRemaining: "50.00" },
			],
			"1000.00"
		);
		const totalApplied = allocations.reduce((sum, a) => sum + Number(a.amountToApply), 0);
		expect(totalApplied).toBe(150);
	});

	it("returns an empty allocation for a zero amount needed", () => {
		expect(allocateCreditFifo([{ id: "cn-1", balanceRemaining: "100.00" }], "0.00")).toEqual([]);
	});

	it("skips a candidate with zero remaining balance", () => {
		const allocations = allocateCreditFifo(
			[
				{ id: "cn-1", balanceRemaining: "0.00" },
				{ id: "cn-2", balanceRemaining: "100.00" },
			],
			"50.00"
		);
		expect(allocations).toEqual([{ creditNoteId: "cn-2", amountToApply: "50.00" }]);
	});
});
