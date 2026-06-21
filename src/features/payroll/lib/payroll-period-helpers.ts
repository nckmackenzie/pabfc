import {
	addMonths,
	differenceInCalendarDays,
	endOfMonth,
	format,
	getMonth,
	getYear,
	isAfter,
	isBefore,
	isSunday,
	parseISO,
	setDate,
	startOfDay,
	startOfMonth,
} from "date-fns";
import {
	PAYROLL_MONTH_MAX,
	PAYROLL_MONTH_MIN,
	PAYROLL_PAY_DATE_FOLLOWING_MONTH_GRACE_DAYS,
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
	STATUTORY_REMITTANCE_DAY,
} from "@/features/payroll/lib/payroll-constants";

function getPayrollPeriodAnchorDate(periodMonth: number, periodYear: number) {
	return new Date(periodYear, periodMonth - 1, 1);
}

export function isValidPayrollPeriodParts(periodMonth: number, periodYear: number) {
	return (
		periodMonth >= PAYROLL_MONTH_MIN &&
		periodMonth <= PAYROLL_MONTH_MAX &&
		periodYear >= PAYROLL_PERIOD_YEAR_MIN &&
		periodYear <= PAYROLL_PERIOD_YEAR_MAX
	);
}

export function getPayrollPeriodStart(periodMonth: number, periodYear: number) {
	return format(startOfMonth(getPayrollPeriodAnchorDate(periodMonth, periodYear)), "yyyy-MM-dd");
}

export function getPayrollPeriodEnd(periodMonth: number, periodYear: number) {
	return format(endOfMonth(getPayrollPeriodAnchorDate(periodMonth, periodYear)), "yyyy-MM-dd");
}

export function getPayrollPeriodName(periodMonth: number, periodYear: number) {
	return format(getPayrollPeriodAnchorDate(periodMonth, periodYear), "LLLL yyyy");
}

export function getPayrollPeriodRemittanceDeadline(periodMonth: number, periodYear: number) {
	const nextMonth = addMonths(getPayrollPeriodAnchorDate(periodMonth, periodYear), 1);
	return format(setDate(startOfMonth(nextMonth), STATUTORY_REMITTANCE_DAY), "yyyy-MM-dd");
}

export function getPayrollPayDateWindow(periodMonth: number, periodYear: number) {
	const anchorDate = getPayrollPeriodAnchorDate(periodMonth, periodYear);
	const periodStart = startOfMonth(anchorDate);
	const graceWindowEnd = setDate(
		startOfMonth(addMonths(anchorDate, 1)),
		PAYROLL_PAY_DATE_FOLLOWING_MONTH_GRACE_DAYS
	);

	return {
		start: format(periodStart, "yyyy-MM-dd"),
		end: format(graceWindowEnd, "yyyy-MM-dd"),
	};
}

export function isPayrollPayDateAllowed(
	payDate: string,
	periodMonth: number,
	periodYear: number
) {
	const parsedPayDate = parseISO(payDate);
	const { start, end } = getPayrollPayDateWindow(periodMonth, periodYear);

	return !isBefore(parsedPayDate, parseISO(start)) && !isAfter(parsedPayDate, parseISO(end));
}

export function isPayrollPayDateSunday(payDate: string) {
	return isSunday(parseISO(payDate));
}

export function getPreviousPayrollPeriod(periodMonth: number, periodYear: number) {
	const previousDate = addMonths(getPayrollPeriodAnchorDate(periodMonth, periodYear), -1);

	return {
		periodMonth: getMonth(previousDate) + 1,
		periodYear: getYear(previousDate),
	};
}

export function getDaysUntilPayrollRemittanceDeadline(deadline: string, today = new Date()) {
	return differenceInCalendarDays(parseISO(deadline), startOfDay(today));
}
