import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { activityLogs, users } from "@/drizzle/schema";
import { activityLogValidateSearch } from "@/features/activity-logs/services/schemas";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getActivityLogs = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(activityLogValidateSearch)
	.handler(
		async ({
			data: { q, from, to },
			context: {
				user: { role, id: userId },
			},
		}) => {
			const filters: Array<SQL> = [];

			if (from) {
				from = `${from}T00:00:00.000Z`;
			}
			if (to) {
				to = `${to}T23:59:59.999Z`;
			}

			if (q) {
				const searchFilters = or(
					ilike(activityLogs.description, `%${q}%`),
					ilike(activityLogs.action, `%${q}%`),
					ilike(activityLogs.os, `%${q}%`),
					ilike(activityLogs.userAgent, `%${q}%`),
					role === "admin" ? ilike(users.name, `%${q}%`) : undefined,
				);
				if (searchFilters) {
					filters.push(searchFilters);
				}
			}

			if (from) {
				filters.push(gte(activityLogs.activityDate, from));
			}

			if (to) {
				filters.push(lte(activityLogs.activityDate, to));
			}

			if (role === "staff") {
				filters.push(eq(activityLogs.userId, userId));
			}

			return db
				.select({
					id: activityLogs.id,
					action: activityLogs.action,
					details: activityLogs.description,
					os: activityLogs.os,
					userAgent: activityLogs.userAgent,
					timestamp: activityLogs.activityDate,
					user: users.name,
					userImage: users.image,
				})
				.from(activityLogs)
				.innerJoin(users, eq(activityLogs.userId, users.id))
				.where(and(...filters))
				.orderBy(desc(activityLogs.activityDate));
		},
	);
