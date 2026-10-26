import { describe, expect, it } from "vitest";
import {
	PLAN_DISTRIBUTION_PALETTE,
	buildPlanDistribution,
	withSharePercentage,
} from "./plan-distribution";

describe("buildPlanDistribution", () => {
	it("drops zero-revenue plans and orders largest first", () => {
		const result = buildPlanDistribution([
			{ name: "A", value: 0 },
			{ name: "B", value: 10 },
			{ name: "C", value: 30 },
		]);
		expect(result.map((slice) => slice.name)).toEqual(["C", "B"]);
	});

	it("gives every plan a colour beyond the palette length", () => {
		const rows = Array.from({ length: PLAN_DISTRIBUTION_PALETTE.length + 3 }, (_, i) => ({
			name: `Plan ${i}`,
			value: 100 - i,
		}));
		const result = buildPlanDistribution(rows);
		expect(result.every((slice) => slice.fill.length > 0)).toBe(true);
		expect(result[PLAN_DISTRIBUTION_PALETTE.length].fill).toBe(PLAN_DISTRIBUTION_PALETTE[0]);
	});
});

describe("withSharePercentage", () => {
	it("computes each slice's share of the total", () => {
		const result = withSharePercentage([
			{ name: "A", value: 25, fill: "x" },
			{ name: "B", value: 75, fill: "y" },
		]);
		expect(result.map((slice) => slice.percentage)).toEqual([25, 75]);
	});
});
