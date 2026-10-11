import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, lte, type SQL, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attendanceLogs, dailyAttendance, members } from "@/drizzle/schema";
import { attendanceValidateSearch } from "@/features/attendances/services/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export type AttendanceTimelineRecord = {
	id: bigint;
	memberName: string;
	image: string | null;
	checkInTime: Date;
	source: string | null;
	biotimeId: number | null;
	deviceId: string | null;
	punchCount: number;
};

export const getAttendances = createServerFn()
	.middleware([authMiddleware])
	.validator(attendanceValidateSearch)
	.handler(async ({ data }) => {
		await requirePermission("attendance:view");

		const memberNameSql = sql<string>`${members.firstName} || ' ' || ${members.lastName}`;
		// attendance_date is already a Nairobi-local calendar date, the same
		// "yyyy-MM-dd" format the date pickers submit — no UTC/timezone
		// conversion needed, unlike the old checkInTime-based filter this
		// replaced (which used normalizeDateRange's UTC day boundaries).
		const filters: Array<SQL> = [
			gte(dailyAttendance.attendanceDate, data.from),
			lte(dailyAttendance.attendanceDate, data.to),
		];
		if (data.q) {
			filters.push(sql`${memberNameSql} ilike ${`%${data.q}%`}`);
		}

		return db
			.select({
				id: attendanceLogs.id,
				memberName: memberNameSql.as("memberName"),
				image: members.image,
				checkInTime: dailyAttendance.firstCheckInTime,
				source: attendanceLogs.source,
				biotimeId: attendanceLogs.biotimeId,
				deviceId: attendanceLogs.deviceId,
				punchCount: dailyAttendance.punchCount,
			})
			.from(dailyAttendance)
			.innerJoin(attendanceLogs, eq(attendanceLogs.id, dailyAttendance.firstAttendanceLogId))
			.innerJoin(members, eq(dailyAttendance.memberId, members.id))
			.where(and(...filters))
			.orderBy(desc(dailyAttendance.firstCheckInTime), desc(members.id));
	});
