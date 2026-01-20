import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { smsBroadcasts, smsTemplates, users } from "@/drizzle/schema";
import { extractVariables } from "@/features/communication/lib/utils";
import {
	broadcastFormSchema,
	templateFormSchema,
} from "@/features/communication/services/schemas";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { internationalizePhoneNumber } from "@/lib/helpers";
import { inngest } from "@/lib/inngest/client";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export const getSmsTemplates = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		return db
			.select({
				id: smsTemplates.id,
				name: smsTemplates.name,
				content: smsTemplates.content,
				variables: smsTemplates.variables,
				description: smsTemplates.description,
				usedCount: db.$count(
					smsBroadcasts,
					eq(smsBroadcasts.smsTemplateId, smsTemplates.id),
				),
			})
			.from(smsTemplates)
			.orderBy(desc(smsTemplates.createdAt));
	});

export const getSmsBroadcasts = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const broadcasts = await db
			.select({
				id: smsBroadcasts.id,
				sentAt: smsBroadcasts.sentAt,
				receipients: smsBroadcasts.receipients,
				smsBroadcastStatus: smsBroadcasts.smsBroadcastStatus,
				name: smsTemplates.name,
				response: smsBroadcasts.response,
			})
			.from(smsBroadcasts)
			.innerJoin(smsTemplates, eq(smsTemplates.id, smsBroadcasts.smsTemplateId))
			.orderBy(desc(smsBroadcasts.sentAt))
			.limit(100);

		return broadcasts.map((broadcast) => ({
			id: broadcast.id,
			sentAt: broadcast.sentAt,
			receipients: broadcast.receipients,
			smsBroadcastStatus: broadcast.smsBroadcastStatus,
			name: broadcast.name,
			totalCost: broadcast.response?.reduce((acc, cur) => {
				const formattedCost = Number(cur.cost.split("KES ")[1]);
				return acc + formattedCost;
			}, 0),
			totalSuccess: broadcast.response
				? broadcast.response?.reduce(
						(acc, cur) => acc + (cur.status === "Success" ? 1 : 0),
						0,
					)
				: 0,
			totalFailed: broadcast.response
				? broadcast.response?.reduce(
						(acc, cur) => acc + (cur.status !== "Success" ? 1 : 0),
						0,
					)
				: 0,
		}));
	});

export const upsertTemplate = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(templateFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			const { name, content, id, description } = data;
			const variables = extractVariables(content);
			const templateName = await db.query.smsTemplates.findFirst({
				columns: { id: true },
				where: and(
					eq(sql`lower(${smsTemplates.name})`, name.toLowerCase()),
					id ? ne(smsTemplates.id, id) : undefined,
				),
			});
			if (templateName) {
				throw new ConflictError("Template name");
			}
			if (!id) {
				await db.insert(smsTemplates).values({
					name,
					content,
					variables,
					description,
				});
			} else {
				await db
					.update(smsTemplates)
					.set({
						name,
						content,
						variables,
						description,
					})
					.where(eq(smsTemplates.id, id));
			}

			await logActivity({
				data: {
					action: id ? "update sms template" : "create sms template",
					userId,
					description: id
						? `Updated sms template ${name}`
						: `Created sms template ${name}`,
				},
			});

			return "Completed successfully";
		},
	);

export const deleteTemplate = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((templateId: string) => templateId)
	.handler(async ({ data }) => {
		try {
			const template = await db.query.smsTemplates.findFirst({
				where: eq(smsTemplates.id, data),
			});
			if (!template) {
				// throw new NotFoundError("Template");
				return { error: true, message: "Template not found" };
			}

			await db.delete(smsTemplates).where(eq(smsTemplates.id, data));
			return { error: false, message: "Completed successfully" };
		} catch (error) {
			console.error(error);
			return { error: true, message: "Failed to delete template" };
		}
	});

export const sendBroadCast = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(broadcastFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			const {
				filterCriteria,
				criteria,
				receipients,
				smsTemplateId,
				content,
				submitType,
			} = data;

			if (submitType === "SEND_TEST") {
				const user = await db.query.users.findFirst({
					columns: { contact: true },
					where: eq(users.id, userId),
				});

				if (!user?.contact) {
					throw new NotFoundError("User");
				}

				await inngest.send({
					name: "app/communications.send-test-to-user",
					data: {
						content,
						contact: [internationalizePhoneNumber(user.contact, true)],
					},
				});

				return "Completed successfully";
			}

			if (submitType === "SUBMIT") {
				const [{ id: broadcastId }] = await db
					.insert(smsBroadcasts)
					.values({
						filterCriteria,
						criteria,
						smsTemplateId,
						smsBroadcastStatus: "sending",
						content,
						receipients,
						sentAt: new Date(),
					})
					.returning({ id: smsBroadcasts.id });

				await inngest.send({
					name: "app/communications.send-sms-broadcast",
					data: {
						broadcastId,
					},
				});
				return broadcastId;
			}
		},
	);
