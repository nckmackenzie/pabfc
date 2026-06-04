import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, lte, type SQL, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attendanceLogs, members } from "@/drizzle/schema";
import { attendanceValidateSearch } from "@/features/attendances/services/schema";
import { normalizeDateRange } from "@/lib/helpers";
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
};

export const getAttendances = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(attendanceValidateSearch)
	.handler(async ({ data }) => {
		await requirePermission("attendance:view");

		const filters: Array<SQL> = [];
		const memberNameSql = sql<string>`${members.firstName} || ' ' || ${members.lastName}`;

		if (data.q) {
			filters.push(sql`${memberNameSql} ilike ${`%${data.q}%`}`);
		}

		if (data.from && data.to) {
			const { from, to } = normalizeDateRange(data.from, data.to, true);
			filters.push(gte(attendanceLogs.checkInTime, from));
			filters.push(lte(attendanceLogs.checkInTime, to));
		}

		return db
			.select({
				id: attendanceLogs.id,
				memberName: memberNameSql.as("memberName"),
				image: members.image,
				checkInTime: attendanceLogs.checkInTime,
				source: attendanceLogs.source,
				biotimeId: attendanceLogs.biotimeId,
				deviceId: attendanceLogs.deviceId,
			})
			.from(attendanceLogs)
			.innerJoin(members, eq(attendanceLogs.memberId, members.id))
			.where(and(...filters))
			.orderBy(desc(attendanceLogs.checkInTime), desc(attendanceLogs.id));
	});
