import { createServerFn } from "@tanstack/react-start";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { type AccountType, ledgerAccounts } from "@/drizzle/schema";
import {
	type AccountsFormSchema,
	accountsFormSchema,
} from "@/features/coa/services/schemas";
import { NotFoundError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
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
	.inputValidator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("chart-of-accounts:view");
		return db
			.select()
			.from(ledgerAccounts)
			.where(
				q
					? or(
							ilike(ledgerAccounts.name, `%${q}%`),
							ilike(ledgerAccounts.description, `%${q}%`),
							ilike(sql`cast(${ledgerAccounts.type} as text)`, `%${q}%`),
						)
					: undefined,
			)
			.orderBy(asc(ledgerAccounts.name));
	});

export const getAccount = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((accountId: number) => accountId)
	.handler(async ({ data: accountId }) => {
		await requirePermission("chart-of-accounts:view");
		return db.query.ledgerAccounts.findFirst({
			columns: { createdAt: false, updatedAt: false, normalBalance: false },
			where: eq(ledgerAccounts.id, accountId),
		});
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

export const updateAccount = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: { values: AccountsFormSchema; id: number }) => data)
	.handler(async ({ data: { values, id: accountId }, context }) => {
		await requirePermission("chart-of-accounts:update");

		const account = await getAccount({ data: accountId });

		if (!account) {
			throw new NotFoundError("Account");
		}

		await db.transaction(async (tx) => {
			await tx
				.update(ledgerAccounts)
				.set({
					name: toTitleCase(values.name),
					type: values.type,
					normalBalance: defaultNormalBalanceForType(values.type),
					parentId: values.isSubcategory ? Number(values.parentId) : null,
					isActive: values.isActive,
					description: values.description,
					isPosting: values.isSubcategory,
				})
				.where(eq(ledgerAccounts.id, accountId))
				.returning({ id: ledgerAccounts.id });

			await logActivity({
				data: {
					action: "update account",
					userId: context.user.id,
					description: `Updated account ${account.name} details`,
				},
			});
		});

		return accountId;
	});

export const deleteAccount = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((accountId: string) => accountId)
	.handler(async ({ data: accountId, context }) => {
		await requirePermission("chart-of-accounts:delete");

		const account = await getAccount({ data: Number(accountId) });

		if (!account) {
			throw new NotFoundError("Account");
		}

		const hasChildAccounts = await db.query.ledgerAccounts.findFirst({
			where: eq(ledgerAccounts.parentId, Number(accountId)),
		});

		if (hasChildAccounts) {
			throw new Error("Account has child accounts");
		}

		await db.transaction(async (tx) => {
			await tx
				.delete(ledgerAccounts)
				.where(eq(ledgerAccounts.id, Number(accountId)));

			await logActivity({
				data: {
					action: "delete account",
					userId: context.user.id,
					description: `Deleted account ${account.name}`,
				},
			});
		});
	});
