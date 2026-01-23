import {
	addDays,
	endOfMonth,
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
