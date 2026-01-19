import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { smsLogs, smsTemplates } from "@/drizzle/schema";
import { extractVariables } from "@/features/communication/lib/utils";
import { templateFormSchema } from "@/features/communication/services/schemas";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
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
				usedCount: db.$count(smsLogs, eq(smsLogs.templateId, smsTemplates.id)),
			})
			.from(smsTemplates)
			.orderBy(desc(smsTemplates.createdAt));
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
		const template = await db.query.smsTemplates.findFirst({
			where: eq(smsTemplates.id, data),
		});
		if (!template) {
			throw new NotFoundError("Template");
		}

		await db.delete(smsTemplates).where(eq(smsTemplates.id, data));
		return "Completed successfully";
	});
