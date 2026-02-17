import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { subDays } from "date-fns";
import { lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { UAParser } from "ua-parser-js";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { activityLogs } from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";

const loggingSchema = z.object({
	userId: z.string().min(1, { error: "User is required" }),
	action: z.string().min(1, { error: "Action is required" }),
	description: z.string().min(1, { error: "Description is required" }),
	id: z.string().optional(),
});

export const logActivity = createServerFn({ method: "POST" })
	.inputValidator(loggingSchema)
	.handler(async ({ data: { userId, action, description, id: insertId } }) => {
		const request = getRequest();
		const userAgent = request.headers.get("user-agent") ?? "unknown";
		const ipAddress =
			request.headers.get("x-forwarded-for") ||
			request.headers.get("x-real-ip") ||
			"127.0.0.1";
		const { browser, os } = UAParser(userAgent);

		await db
			.insert(activityLogs)
			.values({
				id: insertId ?? nanoid(),
				userId,
				action,
				description,
				userAgent: browser.name,
				ipAddress,
				os: os.name,
			})
			.onConflictDoNothing();
	});

export const deleteOlderLogs = createServerFn({ method: "POST" }).handler(
	async () => {
		const data = await db.query.settings.findFirst({
			columns: { data: true },
		});
		const numberOfDays = data?.data?.logRetentionDays ?? 90;
		const date = dateFormat(subDays(new Date(), numberOfDays));
		await db.delete(activityLogs).where(lte(activityLogs.activityDate, date));
	},
);
