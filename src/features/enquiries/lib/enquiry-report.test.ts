import { describe, expect, it } from "vitest";
import {
	average,
	buildEnquiryConversionReport,
	daysBetween,
	type EnquiryReportRow,
	formatDays,
	formatRate,
	median,
	monthsInRange,
	monthStart,
	nextMonthStart,
	ratio,
	UNASSIGNED_FILTER,
	weekStart,
} from "@/features/enquiries/lib/enquiry-report";

const NOVEMBER = { from: "2026-11-01", to: "2026-11-30" };

let counter = 0;
function row(overrides: Partial<EnquiryReportRow> = {}): EnquiryReportRow {
	counter += 1;
	return {
		id: `e${counter}`,
		source: "walk_in",
		status: "new",
		lostReason: null,
		assignedEmployeeId: null,
		assignedEmployeeName: null,
		createdDay: "2026-11-10",
		convertedDay: null,
		directRegistration: false,
		paymentTotal: null,
		paymentEnquiryCount: 0,
		...overrides,
	};
}

function converted(
	createdDay: string,
	convertedDay: string,
	overrides: Partial<EnquiryReportRow> = {}
) {
	return row({
		status: "converted",
		createdDay,
		convertedDay,
		paymentTotal: 5000,
		paymentEnquiryCount: 1,
		...overrides,
	});
}

describe("helpers", () => {
	it("guards divide-by-zero", () => {
		expect(ratio(0, 0)).toBeNull();
		expect(ratio(3, 0)).toBeNull();
		expect(ratio(1, 4)).toBe(0.25);
		expect(formatRate(null)).toBe("—");
		expect(formatRate(0)).toBe("0%");
		expect(formatRate(0.4256)).toBe("42.6%");
		expect(formatDays(null)).toBe("—");
		expect(formatDays(1)).toBe("1 day");
		expect(formatDays(4.5)).toBe("4.5 days");
	});

	it("averages and returns null for nothing", () => {
		expect(average([])).toBeNull();
		expect(average([1, 2, 4])).toBe(2.3);
	});

	it("takes the median of an odd count", () => {
		expect(median([9, 1, 5])).toBe(5);
		expect(median([7])).toBe(7);
	});

	it("takes the median of an even count as the mean of the middle two", () => {
		expect(median([1, 2, 3, 10])).toBe(2.5);
		expect(median([4, 6])).toBe(5);
	});

	it("returns a null median for nothing", () => {
		expect(median([])).toBeNull();
	});

	it("counts whole days between calendar dates and never goes negative", () => {
		expect(daysBetween("2026-11-01", "2026-11-01")).toBe(0);
		expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
		expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
		// A receipt back-dated before the enquiry was logged.
		expect(daysBetween("2026-11-10", "2026-11-03")).toBe(0);
	});

	it("lists every month in a range, across year ends", () => {
		expect(monthsInRange({ from: "2026-11-15", to: "2026-11-20" })).toEqual(["2026-11"]);
		expect(monthsInRange({ from: "2026-11-30", to: "2027-02-01" })).toEqual([
			"2026-11",
			"2026-12",
			"2027-01",
			"2027-02",
		]);
	});

	it("finds the Monday of the week", () => {
		expect(weekStart("2026-11-23")).toBe("2026-11-23"); // Monday
		expect(weekStart("2026-11-25")).toBe("2026-11-23"); // Wednesday
		expect(weekStart("2026-11-29")).toBe("2026-11-23"); // Sunday belongs to the week before
		expect(weekStart("2026-11-30")).toBe("2026-11-30"); // next Monday
		expect(weekStart("2027-01-01")).toBe("2026-12-28"); // across a year end
	});

	it("finds month boundaries", () => {
		expect(monthStart("2026-11-24")).toBe("2026-11-01");
		expect(nextMonthStart("2026-11-24")).toBe("2026-12-01");
		expect(nextMonthStart("2026-12-31")).toBe("2027-01-01");
	});
});

describe("buildEnquiryConversionReport: empty and degenerate cohorts", () => {
	it("handles no enquiries without NaN or Infinity", () => {
		const report = buildEnquiryConversionReport([], NOVEMBER);

		expect(report.cohort).toEqual({
			total: 0,
			converted: 0,
			registered: 0,
			lost: 0,
			open: 0,
			conversionRate: null,
			averageDaysToConvert: null,
			medianDaysToConvert: null,
			directRegistrations: 0,
		});
		expect(report.activity).toEqual({
			conversions: 0,
			firstPaymentRevenue: 0,
			directRegistrations: 0,
		});
		expect(report.bySource).toEqual([]);
		expect(report.byStaff).toEqual([]);
		expect(report.lostReasons).toEqual([]);
		expect(report.monthlyTrend).toEqual([{ month: "2026-11", created: 0, conversions: 0 }]);
		expect(formatRate(report.cohort.conversionRate)).toBe("—");
	});

	it("reports a 0% rate (not an em dash) when everything was lost", () => {
		const report = buildEnquiryConversionReport(
			[
				row({ status: "lost", lostReason: "price" }),
				row({ status: "lost", lostReason: "price" }),
				row({ status: "lost", lostReason: "location" }),
			],
			NOVEMBER
		);
		expect(report.cohort).toMatchObject({
			total: 3,
			lost: 3,
			converted: 0,
			open: 0,
			conversionRate: 0,
		});
		expect(formatRate(report.cohort.conversionRate)).toBe("0%");
		expect(report.cohort.averageDaysToConvert).toBeNull();
		expect(report.lostReasons).toEqual([
			{ reason: "price", label: "Price", count: 2, share: 2 / 3 },
			{ reason: "location", label: "Location", count: 1, share: 1 / 3 },
		]);
	});

	it("labels a lost enquiry with no reason as 'Not recorded'", () => {
		const report = buildEnquiryConversionReport(
			[row({ status: "lost", lostReason: null })],
			NOVEMBER
		);
		expect(report.lostReasons).toEqual([
			{ reason: null, label: "Not recorded", count: 1, share: 1 },
		]);
	});
});

describe("buildEnquiryConversionReport: cohort", () => {
	const rows = [
		converted("2026-11-02", "2026-11-04"), // 2 days
		converted("2026-11-03", "2026-11-10"), // 7 days
		row({ status: "registered" }),
		row({ status: "lost", lostReason: "price" }),
		row({ status: "new" }),
		row({ status: "contacted" }),
	];
	const { cohort } = buildEnquiryConversionReport(rows, NOVEMBER);

	it("splits the cohort by where each enquiry stands", () => {
		expect(cohort).toMatchObject({ total: 6, converted: 2, registered: 1, lost: 1, open: 2 });
		expect(cohort.converted + cohort.registered + cohort.lost + cohort.open).toBe(cohort.total);
	});

	it("computes the conversion rate as converted over total", () => {
		expect(cohort.conversionRate).toBeCloseTo(2 / 6);
	});

	it("computes average and median days to convert, converted only", () => {
		expect(cohort.averageDaysToConvert).toBe(4.5);
		expect(cohort.medianDaysToConvert).toBe(4.5);
	});

	it("gives an odd-count median", () => {
		const report = buildEnquiryConversionReport(
			[
				converted("2026-11-01", "2026-11-02"),
				converted("2026-11-01", "2026-11-04"),
				converted("2026-11-01", "2026-11-20"),
			],
			NOVEMBER
		);
		expect(report.cohort.medianDaysToConvert).toBe(3);
		expect(report.cohort.averageDaysToConvert).toBe(7.7);
	});

	it("ignores enquiries created outside the range", () => {
		const report = buildEnquiryConversionReport(
			[row({ createdDay: "2026-10-31" }), row({ createdDay: "2026-12-01" }), row()],
			NOVEMBER
		);
		expect(report.cohort.total).toBe(1);
	});

	it("does not treat a reverted conversion as converted", () => {
		// After a void: status is registered again and convertedDay is null.
		const report = buildEnquiryConversionReport(
			[row({ status: "registered", convertedDay: null })],
			NOVEMBER
		);
		expect(report.cohort).toMatchObject({ converted: 0, registered: 1 });
		expect(report.activity.conversions).toBe(0);
	});
});

describe("buildEnquiryConversionReport: activity vs cohort are separate measures", () => {
	it("counts a conversion by when it was recorded, whenever the enquiry was created", () => {
		const report = buildEnquiryConversionReport(
			[converted("2026-09-15", "2026-11-05", { paymentTotal: 12000 })],
			NOVEMBER
		);
		expect(report.cohort.total).toBe(0); // created in September
		expect(report.activity).toEqual({
			conversions: 1,
			firstPaymentRevenue: 12000,
			directRegistrations: 0,
		});
	});

	it("keeps an enquiry in the cohort even if it converts after the range", () => {
		const report = buildEnquiryConversionReport([converted("2026-11-20", "2026-12-04")], NOVEMBER);
		expect(report.cohort).toMatchObject({ total: 1, converted: 1 });
		expect(report.activity.conversions).toBe(0);
	});

	it("can count the same enquiry in both when created and converted in the range", () => {
		const report = buildEnquiryConversionReport([converted("2026-11-02", "2026-11-09")], NOVEMBER);
		expect(report.cohort.converted).toBe(1);
		expect(report.activity.conversions).toBe(1);
	});
});

describe("buildEnquiryConversionReport: direct registrations", () => {
	it("counts phone-fallback conversions separately, in both measures", () => {
		const report = buildEnquiryConversionReport(
			[
				converted("2026-11-02", "2026-11-04", { directRegistration: true }),
				converted("2026-11-03", "2026-11-05"),
			],
			NOVEMBER
		);
		expect(report.cohort.directRegistrations).toBe(1);
		expect(report.cohort.converted).toBe(2);
		expect(report.activity.directRegistrations).toBe(1);
	});

	it("does not count an unconverted enquiry as a direct registration", () => {
		const report = buildEnquiryConversionReport([row({ directRegistration: false })], NOVEMBER);
		expect(report.cohort.directRegistrations).toBe(0);
	});
});

describe("buildEnquiryConversionReport: revenue", () => {
	it("splits a group payment between the enquiries it converted", () => {
		const report = buildEnquiryConversionReport(
			[
				converted("2026-11-01", "2026-11-05", { paymentTotal: 9000, paymentEnquiryCount: 3 }),
				converted("2026-11-02", "2026-11-05", { paymentTotal: 9000, paymentEnquiryCount: 3 }),
				converted("2026-11-03", "2026-11-05", { paymentTotal: 9000, paymentEnquiryCount: 3 }),
			],
			NOVEMBER
		);
		expect(report.activity.firstPaymentRevenue).toBe(9000);
	});

	it("rounds shares to cents", () => {
		const report = buildEnquiryConversionReport(
			[converted("2026-11-01", "2026-11-05", { paymentTotal: 100, paymentEnquiryCount: 3 })],
			NOVEMBER
		);
		expect(report.activity.firstPaymentRevenue).toBe(33.33);
	});

	it("only sums converted enquiries in the cohort breakdowns", () => {
		const report = buildEnquiryConversionReport(
			[converted("2026-11-01", "2026-11-05"), row({ status: "lost", paymentTotal: 999 })],
			NOVEMBER
		);
		expect(report.bySource[0].firstPaymentRevenue).toBe(5000);
	});
});

describe("buildEnquiryConversionReport: groups", () => {
	it("groups by source with the full status split, busiest first", () => {
		const report = buildEnquiryConversionReport(
			[
				converted("2026-11-01", "2026-11-03", { source: "instagram" }),
				row({ source: "instagram", status: "lost", lostReason: "price" }),
				row({ source: "instagram" }),
				row({ source: "walk_in" }),
			],
			NOVEMBER
		);
		expect(report.bySource.map((group) => group.key)).toEqual(["instagram", "walk_in"]);
		expect(report.bySource[0]).toMatchObject({
			label: "Instagram",
			enquiries: 3,
			converted: 1,
			lost: 1,
			open: 1,
			averageDaysToConvert: 2,
			firstPaymentRevenue: 5000,
		});
		expect(report.bySource[0].conversionRate).toBeCloseTo(1 / 3);
		expect(report.bySource[1]).toMatchObject({ enquiries: 1, converted: 0, conversionRate: 0 });
		expect(report.bySource[1].averageDaysToConvert).toBeNull();
	});

	it("puts enquiries with no assigned staff in an Unassigned group", () => {
		const report = buildEnquiryConversionReport(
			[
				row({ assignedEmployeeId: "emp-1", assignedEmployeeName: "Jane Doe" }),
				row({ assignedEmployeeId: "emp-1", assignedEmployeeName: "Jane Doe" }),
				row({ assignedEmployeeId: null }),
				converted("2026-11-02", "2026-11-04", { assignedEmployeeId: null }),
			],
			NOVEMBER
		);
		expect(report.byStaff).toHaveLength(2);
		expect(report.byStaff[0]).toMatchObject({ key: "emp-1", label: "Jane Doe", enquiries: 2 });
		expect(report.byStaff[1]).toMatchObject({
			key: UNASSIGNED_FILTER,
			label: "Unassigned",
			enquiries: 2,
			converted: 1,
		});
	});
});

describe("buildEnquiryConversionReport: Nairobi dates and the monthly trend", () => {
	it("uses the Nairobi day the query supplies, not the UTC date", () => {
		// 23:30 UTC on 30 Nov is 02:30 on 1 Dec in Nairobi, so SQL reports "2026-12-01".
		const lateNight = row({ createdDay: "2026-12-01" });
		const november = buildEnquiryConversionReport([lateNight], NOVEMBER);
		const december = buildEnquiryConversionReport([lateNight], {
			from: "2026-12-01",
			to: "2026-12-31",
		});

		expect(november.cohort.total).toBe(0);
		expect(december.cohort.total).toBe(1);
	});

	it("buckets created and converted counts into every month of the range", () => {
		const report = buildEnquiryConversionReport(
			[
				row({ createdDay: "2026-10-31" }),
				row({ createdDay: "2026-11-01" }),
				row({ createdDay: "2026-11-30" }),
				converted("2026-10-20", "2026-12-01"),
				converted("2026-11-15", "2026-11-16"),
			],
			{ from: "2026-10-01", to: "2026-12-31" }
		);
		expect(report.monthlyTrend).toEqual([
			{ month: "2026-10", created: 2, conversions: 0 },
			{ month: "2026-11", created: 3, conversions: 1 },
			{ month: "2026-12", created: 0, conversions: 1 },
		]);
	});

	it("includes months with no activity", () => {
		const report = buildEnquiryConversionReport([], { from: "2026-11-01", to: "2027-01-31" });
		expect(report.monthlyTrend.map((m) => m.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
	});

	it("includes both boundary days of the range", () => {
		const report = buildEnquiryConversionReport(
			[row({ createdDay: "2026-11-01" }), row({ createdDay: "2026-11-30" })],
			NOVEMBER
		);
		expect(report.cohort.total).toBe(2);
	});
});
