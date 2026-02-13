import { createServerFn } from "@tanstack/react-start";
import { and, desc, gte, ilike, lte, type SQL } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attendanceOverview } from "@/drizzle/schema";
import { attendanceValidateSearch } from "@/features/attendances/services/schema";
import { normalizeDateRange } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getAttendances = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(attendanceValidateSearch)
	.handler(async ({ data }) => {
		await requirePermission("attendance:view");

		const filters: Array<SQL> = [];

		if (data.q) {
			filters.push(ilike(attendanceOverview.memberName, `%${data.q}%`));
		}

		if (data.from && data.to) {
			const { from, to } = normalizeDateRange(data.from, data.to, true);
			filters.push(gte(attendanceOverview.checkInTime, from));
			filters.push(lte(attendanceOverview.checkInTime, to));
		}

		return db
			.select()
			.from(attendanceOverview)
			.where(and(...filters))
			.orderBy(desc(attendanceOverview.checkInTime))
			.limit(100);
	});
