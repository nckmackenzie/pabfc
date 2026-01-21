import { createServerFn } from "@tanstack/react-start";
import { addDays, endOfDay, endOfYesterday, startOfDay } from "date-fns";
import { and, avg, between, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	attendanceLogs,
	attendanceOverview,
	memberMemberships,
	members,
	membershipPlans,
} from "@/drizzle/schema";
import { getStatDates } from "@/features/dashboard/lib/date-helpers";
import {
	mockAverageAttendanceByDay,
	mockTodaysAttendances,
} from "@/features/dashboard/lib/mockData";
import { dateFormat } from "@/lib/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";

const {
	monthStartDate,
	startOfLast7Days,
	previousMonthStartDate,
	previousMonthEndDate,
	startOfLast30Days,
	startOfPreviousPeriod,
	endOfPreviousPeriod,
} = getStatDates();

export const dashboardStats = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const [
			activeMembers,
			newMembersThisMonth,
			newMembersLastMonth,
			expiringMemberships,
			totalAttendance,
			totalAttendancePreviousPeriod,
			averageAttendanceDuration,
			expiredMemberships,
		] = await Promise.all([
			db.$count(members, eq(members.memberStatus, "active")),
			db.$count(
				members,
				and(
					eq(members.memberStatus, "active"),
					gte(members.createdAt, monthStartDate),
					lte(members.createdAt, new Date()),
				),
			),
			db.$count(
				members,
				and(
					eq(members.memberStatus, "active"),
					gte(members.createdAt, previousMonthStartDate),
					lte(members.createdAt, previousMonthEndDate),
				),
			),
			db.$count(
				memberMemberships,
				between(
					memberMemberships.endDate,
					dateFormat(startOfLast7Days),
					dateFormat(new Date()),
				),
			),
			db.$count(
				attendanceLogs,
				between(attendanceLogs.checkInTime, startOfLast7Days, new Date()),
			),
			db.$count(
				attendanceLogs,
				between(
					attendanceLogs.checkInTime,
					startOfPreviousPeriod,
					endOfPreviousPeriod,
				),
			),
			db
				.select({ averageDuration: avg(attendanceOverview.duration) })
				.from(attendanceOverview)
				.where(
					between(attendanceOverview.checkInTime, startOfLast7Days, new Date()),
				),
			db.$count(
				memberMemberships,
				and(
					gte(
						memberMemberships.endDate,
						dateFormat(startOfDay(endOfPreviousPeriod)),
					),
					eq(memberMemberships.status, "expired"),
				),
			),
		]);
		return {
			activeMembers,
			newMembersThisMonth,
			expiringMemberships,
			totalAttendance,
			averageAttendanceDuration:
				averageAttendanceDuration[0].averageDuration ?? 0,
			totalAttendancePreviousPeriod,
			newMembersLastMonth,
			expiredMemberships,
		};
	});

export const getTodaysAttendances = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const todaysAttendances = await db
			.select({
				id: attendanceOverview.id,
				memberName: attendanceOverview.memberName,
				image: attendanceOverview.image,
				checkInTime: attendanceOverview.checkInTime,
				checkOutTime: attendanceOverview.checkOutTime,
				activePlanName: attendanceOverview.activePlanName,
				duration: attendanceOverview.duration,
			})
			.from(attendanceOverview)
			.where(
				between(
					attendanceOverview.checkInTime,
					endOfYesterday(),
					endOfDay(new Date()),
				),
			)
			.orderBy(desc(attendanceOverview.checkInTime))
			.execute();

		return process.env.APP_ENV === "production"
			? todaysAttendances
			: todaysAttendances.length > 0
				? todaysAttendances
				: mockTodaysAttendances;
	});

export const getExpiringMemberships = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const expiringMemberships = await db
			.select({
				id: memberMemberships.id,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				planName: membershipPlans.name,
				contact: members.contact,
				image: members.image,
				endDate: memberMemberships.endDate,
			})
			.from(memberMemberships)
			.innerJoin(members, eq(memberMemberships.memberId, members.id))
			.leftJoin(
				membershipPlans,
				eq(memberMemberships.membershipPlanId, membershipPlans.id),
			)
			.where(
				between(
					memberMemberships.endDate,
					dateFormat(startOfLast7Days),
					dateFormat(addDays(new Date(), 7)),
				),
			)
			.orderBy(desc(memberMemberships.endDate));

		return expiringMemberships;

		// return process.env.APP_ENV === "production"
		// 	? expiringMemberships
		// 	: expiringMemberships.length > 0
		// 		? expiringMemberships
		// 		: mockExpiringMemberships;
	});

export const getAverageAttendanceByDay = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const logs = await db
			.select({
				checkInTime: attendanceLogs.checkInTime,
			})
			.from(attendanceLogs)
			.where(gte(attendanceLogs.checkInTime, startOfLast30Days));

		const daysOfWeek = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];

		const dailyCounts: Record<string, number> = {};

		logs.forEach((log) => {
			const dateStr = log.checkInTime.toDateString(); // "Mon Dec 25 2023"
			// Store unique dates to count how many of each weekday passed
			if (!dailyCounts[dateStr]) {
				dailyCounts[dateStr] = 0;
			}
			dailyCounts[dateStr]++;
		});

		// Now group daily totals by day of week
		const dayOfWeekTotals: Record<string, { total: number; count: number }> =
			{};
		daysOfWeek.forEach((day) => {
			dayOfWeekTotals[day] = { total: 0, count: 0 };
		});

		Object.keys(dailyCounts).forEach((dateStr) => {
			const date = new Date(dateStr);
			const dayName = daysOfWeek[date.getDay()];
			dayOfWeekTotals[dayName].total += dailyCounts[dateStr];
			dayOfWeekTotals[dayName].count += 1;
		});

		const result = daysOfWeek.map((day) => {
			const { total, count } = dayOfWeekTotals[day];
			const average = count > 0 ? Math.round(total / count) : 0;

			return {
				day: day,
				attendance: average,
				fill: `var(--chart-2)`,
			};
		});

		return process.env.APP_ENV === "production"
			? result
			: result.length > 0
				? result
				: mockAverageAttendanceByDay;
	});
