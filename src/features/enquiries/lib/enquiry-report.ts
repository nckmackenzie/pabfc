import type { EnquiryLostReason, EnquirySource, EnquiryStatus } from "@/drizzle/schema";
import { enquiryLostReasonLabel, enquirySourceLabel } from "@/features/enquiries/lib/constants";

// Filter value for "enquiries with no assigned staff".
export const UNASSIGNED_FILTER = "unassigned";

// One enquiry as the report query returns it. Days are Nairobi calendar dates
// (yyyy-MM-dd) already converted in SQL, so grouping never depends on the
// server's time zone.
export type EnquiryReportRow = {
	id: string;
	source: EnquirySource;
	status: EnquiryStatus;
	lostReason: EnquiryLostReason | null;
	assignedEmployeeId: string | null;
	assignedEmployeeName: string | null;
	createdDay: string;
	// Null unless the enquiry is currently converted.
	convertedDay: string | null;
	// Converted without ever being "registered": matched to a member by phone.
	directRegistration: boolean;
	// Total of the converting payment, and how many enquiries that one payment
	// converted (a group payment can convert several).
	paymentTotal: number | null;
	paymentEnquiryCount: number;
};

export type ReportRange = { from: string; to: string };

export type ConversionGroupRow = {
	key: string;
	label: string;
	enquiries: number;
	converted: number;
	registered: number;
	lost: number;
	open: number;
	conversionRate: number | null;
	averageDaysToConvert: number | null;
	firstPaymentRevenue: number;
};

export type EnquiryConversionReport = {
	range: ReportRange;
	// Enquiries CREATED in the range, and where they stand today.
	cohort: {
		total: number;
		converted: number;
		registered: number;
		lost: number;
		open: number;
		conversionRate: number | null;
		averageDaysToConvert: number | null;
		medianDaysToConvert: number | null;
		directRegistrations: number;
	};
	// Conversions RECORDED in the range (by convertedAt), whenever the enquiry was created.
	activity: {
		conversions: number;
		firstPaymentRevenue: number;
		directRegistrations: number;
	};
	bySource: ConversionGroupRow[];
	byStaff: ConversionGroupRow[];
	lostReasons: Array<{
		reason: EnquiryLostReason | null;
		label: string;
		count: number;
		share: number | null;
	}>;
	monthlyTrend: Array<{ month: string; created: number; conversions: number }>;
};

// ─── Small helpers ──────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

function dayToUtcMs(day: string) {
	const [year, month, date] = day.split("-").map(Number);
	return Date.UTC(year, month - 1, date);
}

// Whole days from one calendar date to another. Never negative: a receipt
// back-dated before the enquiry was logged counts as same-day.
export function daysBetween(fromDay: string, toDay: string) {
	return Math.max(0, Math.round((dayToUtcMs(toDay) - dayToUtcMs(fromDay)) / MS_PER_DAY));
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return round1(
		sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
	);
}

// null (not NaN or Infinity) when there is nothing to divide by.
export function ratio(part: number, whole: number): number | null {
	return whole === 0 ? null : part / whole;
}

export function formatRate(rate: number | null) {
	return rate === null ? "—" : `${round1(rate * 100)}%`;
}

export function formatDays(days: number | null) {
	return days === null ? "—" : `${days} ${days === 1 ? "day" : "days"}`;
}

const inRange = (day: string, { from, to }: ReportRange) => day >= from && day <= to;

// "2026-10-01" to "2026-12-15" → ["2026-10", "2026-11", "2026-12"]
export function monthsInRange({ from, to }: ReportRange): string[] {
	const months: string[] = [];
	let [year, month] = from.split("-").map(Number);
	const [endYear, endMonth] = to.split("-").map(Number);
	while (year < endYear || (year === endYear && month <= endMonth)) {
		months.push(`${year}-${String(month).padStart(2, "0")}`);
		month += 1;
		if (month > 12) {
			month = 1;
			year += 1;
		}
	}
	return months;
}

// Monday of the week containing `day`.
export function weekStart(day: string): string {
	const date = new Date(dayToUtcMs(day));
	const sinceMonday = (date.getUTCDay() + 6) % 7;
	return new Date(date.getTime() - sinceMonday * MS_PER_DAY).toISOString().slice(0, 10);
}

export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

export function nextMonthStart(day: string): string {
	const [year, month] = day.split("-").map(Number);
	return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

// A group payment's total is shared evenly between the enquiries it converted,
// so summing across enquiries never counts the same money twice.
function revenueShare(row: EnquiryReportRow) {
	if (row.paymentTotal === null) return 0;
	return row.paymentTotal / Math.max(1, row.paymentEnquiryCount);
}

const sumRevenue = (rows: EnquiryReportRow[]) =>
	round2(rows.reduce((sum, row) => sum + revenueShare(row), 0));

const isOpen = (row: EnquiryReportRow) => row.status === "new" || row.status === "contacted";
const isConverted = (row: EnquiryReportRow) =>
	row.status === "converted" && row.convertedDay !== null;

const daysToConvert = (row: EnquiryReportRow) =>
	isConverted(row) ? daysBetween(row.createdDay, row.convertedDay as string) : null;

function summarize(rows: EnquiryReportRow[]) {
	const converted = rows.filter(isConverted);
	const days = converted.map((row) => daysToConvert(row) as number);
	return {
		enquiries: rows.length,
		converted: converted.length,
		registered: rows.filter((row) => row.status === "registered").length,
		lost: rows.filter((row) => row.status === "lost").length,
		open: rows.filter(isOpen).length,
		conversionRate: ratio(converted.length, rows.length),
		averageDaysToConvert: average(days),
		firstPaymentRevenue: sumRevenue(converted),
	};
}

function groupRows(
	rows: EnquiryReportRow[],
	keyOf: (row: EnquiryReportRow) => string,
	labelOf: (row: EnquiryReportRow) => string
): ConversionGroupRow[] {
	const groups = new Map<string, { label: string; rows: EnquiryReportRow[] }>();
	for (const row of rows) {
		const key = keyOf(row);
		const group = groups.get(key) ?? { label: labelOf(row), rows: [] };
		group.rows.push(row);
		groups.set(key, group);
	}

	return [...groups.entries()]
		.map(([key, { label, rows: groupMembers }]) => ({ key, label, ...summarize(groupMembers) }))
		.sort((a, b) => b.enquiries - a.enquiries || a.label.localeCompare(b.label));
}

// ─── The report ─────────────────────────────────────────────────────────────

// `rows` may include enquiries that belong to the cohort, to the activity
// measure, or both; membership is decided here from the Nairobi days.
export function buildEnquiryConversionReport(
	rows: EnquiryReportRow[],
	range: ReportRange
): EnquiryConversionReport {
	const cohort = rows.filter((row) => inRange(row.createdDay, range));
	const activity = rows.filter(
		(row) => isConverted(row) && inRange(row.convertedDay as string, range)
	);

	const cohortSummary = summarize(cohort);
	const cohortConverted = cohort.filter(isConverted);

	const lostRows = cohort.filter((row) => row.status === "lost");
	const lostByReason = new Map<EnquiryLostReason | null, number>();
	for (const row of lostRows) {
		lostByReason.set(row.lostReason, (lostByReason.get(row.lostReason) ?? 0) + 1);
	}

	return {
		range,
		cohort: {
			total: cohortSummary.enquiries,
			converted: cohortSummary.converted,
			registered: cohortSummary.registered,
			lost: cohortSummary.lost,
			open: cohortSummary.open,
			conversionRate: cohortSummary.conversionRate,
			averageDaysToConvert: cohortSummary.averageDaysToConvert,
			medianDaysToConvert: median(cohortConverted.map((row) => daysToConvert(row) as number)),
			directRegistrations: cohortConverted.filter((row) => row.directRegistration).length,
		},
		activity: {
			conversions: activity.length,
			firstPaymentRevenue: sumRevenue(activity),
			directRegistrations: activity.filter((row) => row.directRegistration).length,
		},
		bySource: groupRows(
			cohort,
			(row) => row.source,
			(row) => enquirySourceLabel(row.source)
		),
		byStaff: groupRows(
			cohort,
			(row) => row.assignedEmployeeId ?? UNASSIGNED_FILTER,
			(row) => row.assignedEmployeeName ?? "Unassigned"
		),
		lostReasons: [...lostByReason.entries()]
			.map(([reason, count]) => ({
				reason,
				label: reason ? enquiryLostReasonLabel(reason) : "Not recorded",
				count,
				share: ratio(count, lostRows.length),
			}))
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
		monthlyTrend: monthsInRange(range).map((month) => ({
			month,
			created: cohort.filter((row) => row.createdDay.startsWith(month)).length,
			conversions: activity.filter((row) => (row.convertedDay as string).startsWith(month)).length,
		})),
	};
}
