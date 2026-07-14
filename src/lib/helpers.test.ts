import { describe, expect, it } from "vitest";
import { percentageChangeCalculator } from "./helpers";

describe("percentageChangeCalculator", () => {
	it("returns a neutral zero trend when both periods are zero", () => {
		expect(percentageChangeCalculator(0, 0)).toEqual({
			value: 0,
			isPositive: true,
			isNeutral: true,
			displayValue: "0%",
		});
	});

	it("returns a positive new trend when the previous period is zero", () => {
		expect(percentageChangeCalculator(14100, 0)).toEqual({
			value: 100,
			isPositive: true,
			isNeutral: false,
			displayValue: "New",
		});
	});

	it("returns a full decline when the current period drops to zero", () => {
		expect(percentageChangeCalculator(0, 14100)).toEqual({
			value: 100,
			isPositive: false,
			isNeutral: false,
			displayValue: "-100%",
		});
	});

	it("returns a signed percentage for standard changes", () => {
		expect(percentageChangeCalculator(150, 100)).toEqual({
			value: 50,
			isPositive: true,
			isNeutral: false,
			displayValue: "+50%",
		});
	});

	it("returns a neutral trend for unchanged non-zero values", () => {
		expect(percentageChangeCalculator(100, 100)).toEqual({
			value: 0,
			isPositive: false,
			isNeutral: true,
			displayValue: "0%",
		});
	});
});
