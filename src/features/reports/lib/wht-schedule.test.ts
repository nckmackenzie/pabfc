import { describe, expect, it } from "vitest";
import {
	formatWhtRate,
	summariseWhtSchedule,
	type WhtScheduleRow,
} from "@/features/reports/lib/wht-schedule";

const row = (overrides: Partial<WhtScheduleRow> = {}): WhtScheduleRow => ({
	vendor: "acme consulting",
	taxPin: "P051234567A",
	invoiceNo: "INV-001",
	invoiceDate: "2026-03-05",
	description: "audit fees",
	grossAmount: "10000.00",
	rate: "5.00",
	whtAmount: "500.00",
	certificateNo: null,
	...overrides,
});

describe("formatWhtRate", () => {
	it("drops the trailing zeros a numeric(5,2) column carries", () => {
		expect(formatWhtRate(5)).toBe("5%");
		expect(formatWhtRate(10)).toBe("10%");
	});

	it("keeps a genuine fraction", () => {
		expect(formatWhtRate(7.5)).toBe("7.5%");
		expect(formatWhtRate(12.25)).toBe("12.25%");
	});
});

describe("summariseWhtSchedule", () => {
	it("groups rows by the rate applied and totals each band", () => {
		const summary = summariseWhtSchedule([
			row(),
			row({ invoiceNo: "INV-002", grossAmount: "4000.00", whtAmount: "200.00" }),
			row({
				invoiceNo: "INV-003",
				grossAmount: "50000.00",
				rate: "10.00",
				whtAmount: "5000.00",
			}),
		]);

		expect(summary.groups).toHaveLength(2);

		const [five, ten] = summary.groups;
		expect(five.label).toBe("5%");
		expect(five.rows).toHaveLength(2);
		expect(five.grossAmount).toBe(14_000);
		expect(five.whtAmount).toBe(700);

		expect(ten.label).toBe("10%");
		expect(ten.grossAmount).toBe(50_000);
		expect(ten.whtAmount).toBe(5_000);
	});

	it("treats rates that differ only in stored precision as one band", () => {
		const summary = summariseWhtSchedule([row({ rate: "5.00" }), row({ rate: "5" })]);
		expect(summary.groups).toHaveLength(1);
		expect(summary.groups[0].rows).toHaveLength(2);
	});

	it("keeps a fractional rate in its own band", () => {
		const summary = summariseWhtSchedule([
			row({ rate: "5.00" }),
			row({ rate: "7.50" }),
		]);
		expect(summary.groups.map((group) => group.label)).toEqual(["5%", "7.5%"]);
	});

	it("totals across every band", () => {
		const summary = summariseWhtSchedule([
			row(),
			row({ rate: "3.00", whtAmount: "300.00" }),
		]);

		expect(summary.grossAmount).toBe(20_000);
		expect(summary.whtAmount).toBe(800);
	});

	it("preserves the order bands first appear in", () => {
		const summary = summariseWhtSchedule([
			row({ rate: "10.00" }),
			row({ rate: "3.00" }),
			row({ rate: "10.00" }),
		]);

		expect(summary.groups.map((group) => group.label)).toEqual(["10%", "3%"]);
	});

	it("keeps a row with no rate rather than dropping it from the filing", () => {
		const summary = summariseWhtSchedule([row({ rate: null })]);

		expect(summary.groups).toHaveLength(1);
		expect(summary.groups[0].label).toBe("Unspecified rate");
		expect(summary.groups[0].rate).toBeNull();
		expect(summary.whtAmount).toBe(500);
	});

	it("is empty for a period with no deductions", () => {
		expect(summariseWhtSchedule([])).toEqual({
			groups: [],
			grossAmount: 0,
			whtAmount: 0,
		});
	});

	it("totals to the cent on amounts that do not divide cleanly", () => {
		const summary = summariseWhtSchedule([
			row({ grossAmount: "333.33", whtAmount: "16.67" }),
			row({ grossAmount: "333.33", whtAmount: "16.67" }),
			row({ grossAmount: "333.34", whtAmount: "16.67" }),
		]);

		expect(summary.grossAmount).toBe(1_000);
		expect(summary.whtAmount).toBe(50.01);
	});
});
