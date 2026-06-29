import { roundDecimal } from "@/lib/helpers";
import {
	eachDayOfInterval,
	endOfMonth,
	format,
	isAfter,
	isWeekend,
	max as maxDate,
	min as minDate,
	parseISO,
} from "date-fns";

export type ProrationReason = "new_hire" | "termination" | null;

export type ProratedDaysResult = {
	isProrated: boolean;
	proratedDays: number;
	totalWorkingDays: number;
	proratedReason: ProrationReason;
	proratedFactor: number;
	workedFrom: Date;
	workedTo: Date;
};

function toIsoDate(value: Date) {
	return format(value, "yyyy-MM-dd");
}

function countWorkingDays({
	start,
	end,
	publicHolidays,
}: {
	start: Date;
	end: Date;
	publicHolidays: Set<string>;
}) {
	return eachDayOfInterval({ start, end }).reduce((total, currentDate) => {
		if (isWeekend(currentDate)) {
			return total;
		}

		return publicHolidays.has(toIsoDate(currentDate)) ? total : total + 1;
	}, 0);
}

export function computeWorkingDaysInMonth(
	periodYear: number,
	periodMonth: number,
	publicHolidays: string[]
) {
	// Use a local-time Date so startOfMonth/endOfMonth/eachDayOfInterval are all
	// consistent with each other and with parseISO (which also returns local time).
	// Date.UTC() + startOfMonth() would mismatch on servers west of UTC.
	const monthStart = new Date(periodYear, periodMonth - 1, 1);
	const monthEnd = endOfMonth(monthStart);
	return countWorkingDays({
		start: monthStart,
		end: monthEnd,
		publicHolidays: new Set(publicHolidays),
	});
}

export function computeEmployeeProratedDays(
	hireDate: string | null,
	terminationDate: string | null,
	periodStart: string,
	periodEnd: string,
	publicHolidays: string[]
): ProratedDaysResult {
	const periodStartDate = parseISO(periodStart);
	const periodEndDate = parseISO(periodEnd);
	const hireDateValue = hireDate ? parseISO(hireDate) : periodStartDate;
	const terminationDateValue = terminationDate ? parseISO(terminationDate) : periodEndDate;
	const workedFrom = maxDate([hireDateValue, periodStartDate]);
	const workedTo = minDate([terminationDateValue, periodEndDate]);
	const publicHolidaySet = new Set(publicHolidays);
	const totalWorkingDays = computeWorkingDaysInMonth(
		periodStartDate.getFullYear(),
		periodStartDate.getMonth() + 1,
		publicHolidays
	);
	const proratedReason: ProrationReason =
		hireDate && hireDate > periodStart
			? "new_hire"
			: terminationDate && terminationDate < periodEnd
				? "termination"
				: null;

	if (isAfter(workedFrom, workedTo)) {
		return {
			isProrated: true,
			proratedDays: 0,
			totalWorkingDays,
			proratedReason,
			proratedFactor: 0,
			workedFrom,
			workedTo,
		};
	}

	const proratedDays = countWorkingDays({
		start: workedFrom,
		end: workedTo,
		publicHolidays: publicHolidaySet,
	});

	return {
		isProrated: proratedDays < totalWorkingDays,
		proratedDays,
		totalWorkingDays,
		proratedReason,
		proratedFactor: totalWorkingDays > 0 ? proratedDays / totalWorkingDays : 0,
		workedFrom,
		workedTo,
	};
}

export function applyProration(fullMonthGross: number, proratedFactor: number) {
	return roundDecimal(fullMonthGross * proratedFactor);
}
