import { createServerFn } from "@tanstack/react-start";
import { db } from "@/drizzle/db";
import { type AccountType, ledgerAccounts } from "@/drizzle/schema";
import { accountsFormSchema } from "@/features/coa/services/schemas";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

function defaultNormalBalanceForType(type: AccountType): "debit" | "credit" {
	switch (type) {
		case "asset":
		case "expense":
			return "debit";
		case "liability":
		case "equity":
		case "revenue":
			return "credit";
	}
}

export const getAccounts = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("chart-of-accounts:view");
		return db.select().from(ledgerAccounts);
	});

export const createAccount = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(accountsFormSchema)
	.handler(async ({ data, context }) => {
		await requirePermission("chart-of-accounts:create");

		const accountId = await db.transaction(async (tx) => {
			const [{ id }] = await tx
				.insert(ledgerAccounts)
				.values({
					name: toTitleCase(data.name),
					type: data.type,
					normalBalance: defaultNormalBalanceForType(data.type),
					parentId: data.isSubcategory ? Number(data.parentId) : null,
					isActive: data.isActive,
					description: data.description,
					isPosting: data.isSubcategory,
				})
				.returning({ id: ledgerAccounts.id });

			await logActivity({
				data: {
					action: "create account",
					userId: context.user.id,
					description: `Created account ${data.name}`,
				},
			});

			return id;
		});

		return accountId;
	});
