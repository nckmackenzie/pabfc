import { createServerFn } from "@tanstack/react-start";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	type AccountType,
	bankAccounts,
	ledgerAccounts,
} from "@/drizzle/schema";
import {
	type AccountsFormSchema,
	accountsFormSchema,
} from "@/features/coa/services/schemas";
import { NotFoundError } from "@/lib/error-handling/app-error";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { createJournalEntry, createOrGetAccountId } from "@/services/journal";

export function defaultNormalBalanceForType(
	type: AccountType,
): "debit" | "credit" {
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
			.orderBy(asc(ledgerAccounts.type), asc(ledgerAccounts.name))
			.then((data) =>
				data.map((d) => ({ ...d, name: toTitleCase(d.name.toLowerCase()) })),
			);
	});

export const getAccount = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((accountId: number) => accountId)
	.handler(async ({ data: accountId }) => {
		await requirePermission("chart-of-accounts:view");
		return db.query.ledgerAccounts.findFirst({
			columns: { createdAt: false, updatedAt: false, normalBalance: false },
			with: { bank: { columns: { accountNumber: true } } },
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

			if (data.isBankAccount) {
				await tx.insert(bankAccounts).values({
					bankName: data.name,
					accountId: id,
					accountNumber: data.accountNumber as string,
					currencyCode: "KES",
				});

				if (data.openingBalance && data.openingBalance !== 0) {
					const openingBalanceEquity = await createOrGetAccountId(
						"opening balance equity",
						"equity",
						tx,
					);

					const description = data.description
						? data.description
						: `Opening balance for ${data.name}`;

					await createJournalEntry({
						entry: {
							entryDate: data.openingBalanceDate
								? dateFormat(data.openingBalanceDate)
								: dateFormat(new Date()),
							source: "opening balance",
							sourceId: id.toString(),
							reference: data.accountNumber,
							description,
						},
						lines: [
							{
								lineNumber: 1,
								accountId: id,
								amount: data.openingBalance.toString(),
								memo: description,
								dc: +data.openingBalance > 0 ? "debit" : "credit",
							},
							{
								lineNumber: 2,
								accountId: openingBalanceEquity,
								amount: data.openingBalance.toString(),
								memo: description,
								dc: +data.openingBalance > 0 ? "credit" : "debit",
							},
						],
						tx,
					});
				}
			}

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

			if (values.isBankAccount) {
				const bankId = await db.query.bankAccounts.findFirst({
					where: eq(bankAccounts.accountId, accountId),
				});
				if (!bankId) {
					await tx.insert(bankAccounts).values({
						bankName: values.name,
						accountId: accountId,
						accountNumber: values.accountNumber as string,
						currencyCode: "KES",
					});
				} else {
					await tx
						.update(bankAccounts)
						.set({
							bankName: values.name,
							accountNumber: values.accountNumber as string,
						})
						.where(eq(bankAccounts.accountId, accountId));
				}
			}

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

export const getVatAccountId = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const billing = await db.query.settings.findFirst({
			columns: { billing: true },
		});

		return billing?.billing?.vatAccountId ?? null;
	});

export const getCashEquivalentsAccountId = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((account: string) => account)
	.handler(async ({ data: account }) => {
		const ledgerAccount = await db.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: (accounts, { eq }) =>
				eq(
					sql`lower(${accounts.name})`,
					account === "cash" ? "cash at hand" : "cash at bank",
				),
		});

		return ledgerAccount?.id;
	});
