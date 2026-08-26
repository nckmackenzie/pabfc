import {
	addDays,
	endOfMonth,
	formatDistanceToNow,
	startOfDay,
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

export function getExpiredMembershipStatDates(today = new Date()) {
	return {
		periodStart: subDays(today, 30),
		periodEnd: today,
	};
}

export function getExpiringMembershipStatDates(today = new Date()) {
	return {
		periodStart: subDays(today, 7),
		periodEnd: addDays(today, 7),
	};
}

const FINANCE_TIME_ZONE = "Africa/Nairobi";

type ZonedDateParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

function getFinanceDateParts(date: Date): ZonedDateParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: FINANCE_TIME_ZONE,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hourCycle: "h23",
	}).formatToParts(date);

	return Object.fromEntries(
		parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)])
	) as ZonedDateParts;
}

function financeWallClockToDate(parts: ZonedDateParts, milliseconds = 0) {
	const targetTimestamp = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
		milliseconds
	);
	let resultTimestamp = targetTimestamp;

	for (let attempt = 0; attempt < 3; attempt++) {
		const actual = getFinanceDateParts(new Date(resultTimestamp));
		const actualTimestamp = Date.UTC(
			actual.year,
			actual.month - 1,
			actual.day,
			actual.hour,
			actual.minute,
			actual.second,
			milliseconds
		);
		const difference = targetTimestamp - actualTimestamp;
		resultTimestamp += difference;
		if (difference === 0) break;
	}

	return new Date(resultTimestamp);
}

export function getFinanceStatDates(today = new Date()) {
	const current = getFinanceDateParts(today);
	const previousMonth = current.month === 1 ? 12 : current.month - 1;
	const previousYear = current.month === 1 ? current.year - 1 : current.year;
	const currentPeriodStart = financeWallClockToDate({
		year: current.year,
		month: current.month,
		day: 1,
		hour: 0,
		minute: 0,
		second: 0,
	});
	const currentPeriodEnd = today;
	const previousPeriodStart = financeWallClockToDate({
		year: previousYear,
		month: previousMonth,
		day: 1,
		hour: 0,
		minute: 0,
		second: 0,
	});
	const previousMonthLastDay = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
	const previousPeriodEnd = financeWallClockToDate(
		{
			year: previousYear,
			month: previousMonth,
			day: Math.min(current.day, previousMonthLastDay),
			hour: current.hour,
			minute: current.minute,
			second: current.second,
		},
		today.getMilliseconds()
	);

	return {
		currentPeriodStart,
		currentPeriodEnd,
		previousPeriodStart,
		previousPeriodEnd,
	};
}

export function getMembershipExpiryStatus(
	rawEndDate: Date | string | null
): { isExpired: boolean; label: string } | null {
	if (!rawEndDate) return null;

	const endDate =
		rawEndDate instanceof Date ? startOfDay(rawEndDate) : new Date(`${rawEndDate}T00:00:00`);
	const isExpired = endDate < startOfDay(new Date());

	return {
		isExpired,
		label: isExpired
			? `Expired ${formatDistanceToNow(endDate, { addSuffix: true })}`
			: `Expiring in ${formatDistanceToNow(endDate)}`,
	};
}
