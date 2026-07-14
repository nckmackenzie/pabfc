import {
	addDays,
	endOfMonth,
	getDate,
	lastDayOfMonth,
	startOfMonth,
	subDays,
	subMonths,
} from "date-fns";

export function getStatDates() {
	const monthStartDate = startOfMonth(new Date());
	const startOfLast7Days = subDays(new Date(), 7);
	const previousMonthStartDate = subMonths(monthStartDate, 1);
	const previousMonthEndDate = endOfMonth(previousMonthStartDate);
	const startOfLast30Days = subDays(new Date(), 30);
	const startOfPreviousPeriod = subDays(new Date(), 60);
	const endOfPreviousPeriod = addDays(startOfPreviousPeriod, 30);

	return {
		monthStartDate,
		startOfLast7Days,
		previousMonthStartDate,
		previousMonthEndDate,
		startOfLast30Days,
		startOfPreviousPeriod,
		endOfPreviousPeriod,
	};
}

export function getFinanceStatDates(today = new Date()) {
	const currentPeriodStart = startOfMonth(today);
	const currentPeriodEnd = today;
	const previousPeriodStart = startOfMonth(subMonths(today, 1));
	const previousMonthLastDay = getDate(lastDayOfMonth(previousPeriodStart));
	const currentDayOfMonth = getDate(today);
	const previousPeriodDay = Math.min(currentDayOfMonth, previousMonthLastDay);
	const previousPeriodEnd = new Date(previousPeriodStart);

	previousPeriodEnd.setDate(previousPeriodDay);
	previousPeriodEnd.setHours(
		today.getHours(),
		today.getMinutes(),
		today.getSeconds(),
		today.getMilliseconds(),
	);

	return {
		currentPeriodStart,
		currentPeriodEnd,
		previousPeriodStart,
		previousPeriodEnd,
	};
}
