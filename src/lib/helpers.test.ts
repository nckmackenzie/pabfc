import { describe, expect, it } from "vitest";
import { formatMinutesDuration, percentageChangeCalculator } from "./helpers";

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

describe("formatMinutesDuration", () => {
	it("formats a whole-minute value under an hour", () => {
		expect(formatMinutesDuration(45)).toBe("45m");
	});

	it("splits minutes into hours and minutes", () => {
		expect(formatMinutesDuration(83.75)).toBe("1h 24m");
	});

	it("omits the minutes part on an exact hour", () => {
		expect(formatMinutesDuration(120)).toBe("2h");
	});

	// `avg(vw_attendance_details.duration)` arrives from the driver as a numeric
	// string, which is what the dashboard stat card passes in.
	it("accepts the numeric string the driver returns", () => {
		expect(formatMinutesDuration("83.7500000000000000")).toBe("1h 24m");
	});

	it("renders no attendance as 0m rather than an empty or negative value", () => {
		expect(formatMinutesDuration(null)).toBe("0m");
		expect(formatMinutesDuration(undefined)).toBe("0m");
		expect(formatMinutesDuration("")).toBe("0m");
		expect(formatMinutesDuration(0)).toBe("0m");
		expect(formatMinutesDuration(-5)).toBe("0m");
	});

	it("falls back to 0m for an unparseable value", () => {
		expect(formatMinutesDuration("not-a-number")).toBe("0m");
	});
});
