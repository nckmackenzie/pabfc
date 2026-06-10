import { createServerFn } from "@tanstack/react-start";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { payees } from "@/drizzle/schema";
import { payeeSchema } from "@/features/expenses/services/schemas";
import { failure, success } from "@/lib/result";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export const getPayees = createServerFn().handler(async () => {
	return db
		.select({ id: payees.id, name: payees.name })
		.from(payees)
		.where(eq(payees.isActive, true))
		.orderBy(asc(payees.name));
});

export const createPayee = createServerFn()
	.middleware([authMiddleware])
	.validator(payeeSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			try {
				const payee = await db.query.payees.findFirst({
					where: eq(sql`lower(${payees.name})`, data.name.trim().toLowerCase()),
				});
				if (payee) {
					return failure({
						type: "ConflictError",
						message: "Payee name already exists",
					});
				}
				await db
					.insert(payees)
					.values({
						name: toTitleCase(data.name),
						isActive: true,
					})
					.returning({ id: payees.id });

				await logActivity({
					data: {
						action: "create payee",
						description: `Created payee ${data.name}`,
						userId,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to create payee",
				});
			}
		},
	);
