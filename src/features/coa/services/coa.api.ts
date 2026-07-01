import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	type AccountType,
	bankAccounts,
	journalEntries,
	journalLines,
	ledgerAccounts,
} from "@/drizzle/schema";
import { type AccountsFormSchema, accountsFormSchema } from "@/features/coa/services/schemas";
import { dateFormat, toNumber } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { searchValidateSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { createJournalEntry, createOrGetAccountId } from "@/services/journal";
import { collectDescendantIds, filterPotentialParents } from "../lib/parent-account-filter";
import {
	childIsPosting,
	parentIsPostingOnAttach,
	shouldRestoreParentPosting,
} from "../lib/posting-rules";
import { getNextChildAccountCode, getNextRootAccountCode } from "./account-code-generator";
import { buildTreeWithRollup, calcNormalBalance, isAccountTypeMismatch } from "./helpers";

type Totals = { debits: string; credits: string };

async function validateParentAccountForAttach(parentId: number, childType: AccountType) {
	const [parent, directJournalLine] = await Promise.all([
		db.query.ledgerAccounts.findFirst({
			columns: { type: true, isActive: true },
			where: eq(ledgerAccounts.id, parentId),
		}),
		db.query.journalLines.findFirst({
			columns: { id: true },
			where: eq(journalLines.accountId, parentId),
		}),
	]);

	if (!parent) {
		return failure({
			type: "NotFoundError",
			message: "Parent account not found",
		});
	}

	if (!parent.isActive) {
		return failure({
			type: "ApplicationError",
			message: "Parent account must be active",
		});
	}

	if (directJournalLine) {
		return failure({
			type: "ApplicationError",
			message: "Parent account cannot have direct journal entries",
		});
	}

	if (isAccountTypeMismatch(childType, parent.type)) {
		return failure({
			type: "ApplicationError",
			message: `Account type must match parent account type (${toTitleCase(parent.type)})`,
		});
	}

	return null;
}

export function defaultNormalBalanceForType(type: AccountType): "debit" | "credit" {
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

const createAccount = async ({ data, userId }: { data: AccountsFormSchema; userId: string }) => {
	await requirePermission("chart-of-accounts:create");

	const parentId = data.isSubcategory ? Number(data.parentId) : null;

	if (parentId !== null) {
		const parentValidationFailure = await validateParentAccountForAttach(parentId, data.type);
		if (parentValidationFailure) return parentValidationFailure;
	}

	try {
		await db.transaction(async (tx) => {
			const existingAccounts = await tx.query.ledgerAccounts.findMany({
				columns: { code: true },
			});
			const allAssignedCodes = existingAccounts.map((account) => account.code);

			let code: string;

			if (parentId !== null) {
				const [parentAccount, siblingAccounts] = await Promise.all([
					tx.query.ledgerAccounts.findFirst({
						columns: { code: true },
						where: eq(ledgerAccounts.id, parentId),
					}),
					tx.query.ledgerAccounts.findMany({
						columns: { code: true },
						where: eq(ledgerAccounts.parentId, parentId),
					}),
				]);

				code = getNextChildAccountCode({
					parentCode: parentAccount?.code ?? null,
					siblingCodes: siblingAccounts.map((account) => account.code),
					allAssignedCodes,
				});
			} else {
				const rootAccounts = await tx.query.ledgerAccounts.findMany({
					columns: { code: true },
					where: and(eq(ledgerAccounts.type, data.type), sql`${ledgerAccounts.parentId} is null`),
				});

				code = getNextRootAccountCode({
					type: data.type,
					existingCodes: rootAccounts.map((account) => account.code),
					allAssignedCodes,
				});
			}

			const [{ id }] = await tx
				.insert(ledgerAccounts)
				.values({
					code,
					name: toTitleCase(data.name),
					type: data.type,
					normalBalance: defaultNormalBalanceForType(data.type),
					parentId,
					isActive: data.isActive,
					description: data.description,
					// A newly created account is always a leaf → posting by default.
					isPosting: childIsPosting(false),
				})
				.returning({ id: ledgerAccounts.id });

			// Selecting an account as a parent makes it non-posting (it now only
			// aggregates its children's balances).
			if (parentId !== null) {
				await tx
					.update(ledgerAccounts)
					.set({ isPosting: parentIsPostingOnAttach() })
					.where(eq(ledgerAccounts.id, parentId));
			}

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
						tx
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
					userId,
					description: `Created account ${data.name}`,
				},
			});
		});
		return success(undefined);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create account",
		});
	}
};

const updateAccount = async ({ data, userId }: { data: AccountsFormSchema; userId: string }) => {
	if (!data.id) {
		return failure({
			type: "ApplicationError",
			message: "Account is required",
		});
	}

	const accountId = toNumber(data.id);

	if (typeof accountId !== "number") {
		return failure({ type: "ApplicationError", message: "Invalid Account ID" });
	}

	try {
		await requirePermission("chart-of-accounts:update");

		const account = await getAccount({ data: accountId });

		if (!account) {
			return failure({ type: "NotFoundError", message: "Account not found" });
		}

		const newParentId = data.isSubcategory ? Number(data.parentId) : null;
		const oldParentId = account.parentId;

		// Snapshot of the full tree for cycle detection and descendant type
		// propagation.
		const allAccounts = await db
			.select({ id: ledgerAccounts.id, parentId: ledgerAccounts.parentId })
			.from(ledgerAccounts);

		if (newParentId !== null) {
			if (newParentId === accountId) {
				return failure({
					type: "ApplicationError",
					message: "An account cannot be its own parent",
				});
			}

			const descendantIds = collectDescendantIds(allAccounts, accountId);
			if (descendantIds.has(newParentId)) {
				return failure({
					type: "ApplicationError",
					message: "Cannot set one of the account's descendants as its parent",
				});
			}

			const parentValidationFailure = await validateParentAccountForAttach(newParentId, data.type);
			if (parentValidationFailure) return parentValidationFailure;
		}

		// An account is a leaf (posting) unless it already has children of its own,
		// in which case it must remain non-posting regardless of the form input.
		const [{ childCount }] = await db
			.select({ childCount: sql<number>`count(*)::int` })
			.from(ledgerAccounts)
			.where(eq(ledgerAccounts.parentId, accountId));
		const selfIsPosting = childIsPosting(childCount > 0);

		await db.transaction(async (tx) => {
			await tx
				.update(ledgerAccounts)
				.set({
					name: toTitleCase(data.name),
					type: data.type,
					normalBalance: defaultNormalBalanceForType(data.type),
					parentId: newParentId,
					isActive: data.isActive,
					description: data.description,
					isPosting: selfIsPosting,
				})
				.where(eq(ledgerAccounts.id, accountId))
				.returning({ id: ledgerAccounts.id });

			// Selecting a parent makes that parent non-posting.
			if (newParentId !== null) {
				await tx
					.update(ledgerAccounts)
					.set({ isPosting: parentIsPostingOnAttach() })
					.where(eq(ledgerAccounts.id, newParentId));
			}

			// If this account was detached from a previous parent, that parent
			// becomes a posting leaf again once it has no remaining children.
			if (oldParentId !== null && oldParentId !== newParentId) {
				const [{ remaining }] = await tx
					.select({ remaining: sql<number>`count(*)::int` })
					.from(ledgerAccounts)
					.where(eq(ledgerAccounts.parentId, oldParentId));
				if (shouldRestoreParentPosting(remaining)) {
					await tx
						.update(ledgerAccounts)
						.set({ isPosting: true })
						.where(eq(ledgerAccounts.id, oldParentId));
				}
			}

			if (account.type !== data.type) {
				const getDescendantIds = (parentIds: number[]): number[] => {
					const children = allAccounts.filter(
						(a) => a.parentId !== null && parentIds.includes(a.parentId)
					);
					if (children.length === 0) return [];
					const childIds = children.map((c) => c.id);
					return [...childIds, ...getDescendantIds(childIds)];
				};

				const descendantIds = getDescendantIds([accountId]);
				if (descendantIds.length > 0) {
					await tx
						.update(ledgerAccounts)
						.set({
							type: data.type,
							normalBalance: defaultNormalBalanceForType(data.type),
						})
						.where(inArray(ledgerAccounts.id, descendantIds));
				}
			}

			const bankId = await tx.query.bankAccounts.findFirst({
				columns: { id: true },
				where: eq(bankAccounts.accountId, accountId),
			});
			if (data.isBankAccount) {
				if (!bankId) {
					await tx.insert(bankAccounts).values({
						bankName: data.name,
						accountId: accountId,
						accountNumber: data.accountNumber as string,
						currencyCode: "KES",
					});
				} else {
					await tx
						.update(bankAccounts)
						.set({
							bankName: data.name,
							accountNumber: data.accountNumber as string,
						})
						.where(eq(bankAccounts.accountId, accountId));
				}
			}
			if (!data.isBankAccount && bankId) {
				await tx.delete(bankAccounts).where(eq(bankAccounts.accountId, accountId));
			}

			await logActivity({
				data: {
					action: "update account",
					userId,
					description: `Updated account ${account.name} details`,
				},
			});
		});

		return success(undefined);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update account",
		});
	}
};

export const getAccounts = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
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
							ilike(sql`cast(${ledgerAccounts.type} as text)`, `%${q}%`)
						)
					: undefined
			)
			.orderBy(asc(ledgerAccounts.type), asc(ledgerAccounts.name))
			.then((data) => data.map((d) => ({ ...d, name: toTitleCase(d.name.toLowerCase()) })));
	});

export const getPotentialParentAccounts = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator((accountId?: number | null) => accountId ?? null)
	.handler(async ({ data: accountId }) => {
		await requirePermission("chart-of-accounts:view");

		const [accounts, journalLineAccounts] = await Promise.all([
			db
				.select({
					id: ledgerAccounts.id,
					code: ledgerAccounts.code,
					name: ledgerAccounts.name,
					type: ledgerAccounts.type,
					parentId: ledgerAccounts.parentId,
					isActive: ledgerAccounts.isActive,
				})
				.from(ledgerAccounts),
			db.selectDistinct({ accountId: journalLines.accountId }).from(journalLines),
		]);

		const accountIdsWithJournalLines = new Set(journalLineAccounts.map((row) => row.accountId));

		return filterPotentialParents({
			accounts,
			accountIdsWithJournalLines,
			currentAccountId: accountId ?? undefined,
		}).map((account) => ({
			value: account.id,
			label: toTitleCase(account.name.toLowerCase()),
			type: account.type,
		}));
	});

export const getAccountsWithBalances = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		// await requirePermission("chart-of-accounts:view");

		// 1) Fetch accounts
		const accounts = await db
			.select()
			.from(ledgerAccounts)
			.where(
				q
					? or(
							ilike(ledgerAccounts.name, `%${q}%`),
							ilike(ledgerAccounts.description, `%${q}%`),
							ilike(sql`cast(${ledgerAccounts.type} as text)`, `%${q}%`)
						)
					: undefined
			)
			.orderBy(asc(ledgerAccounts.type), asc(ledgerAccounts.name));

		// 2) We’ll compute balances only for Balance Sheet types for now
		const bs = accounts.filter(
			(a) => a.type === "asset" || a.type === "liability" || a.type === "equity"
		);
		const bsIds = bs.map((a) => a.id);

		const effectiveAsOf = new Date().toISOString().slice(0, 10);

		// 3) Aggregate journal totals by accountId
		const totalsRows =
			bsIds.length === 0
				? []
				: await db
						.select({
							accountId: journalLines.accountId,
							debits:
								sql<string>`coalesce(sum(case when ${journalLines.dc}='debit' then ${journalLines.amount} else 0 end),0)::numeric`.as(
									"debits"
								),
							credits:
								sql<string>`coalesce(sum(case when ${journalLines.dc}='credit' then ${journalLines.amount} else 0 end),0)::numeric`.as(
									"credits"
								),
						})
						.from(journalLines)
						.innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
						.where(
							and(
								inArray(journalLines.accountId, bsIds),
								lte(journalEntries.entryDate, effectiveAsOf)
							)
						)
						.groupBy(journalLines.accountId);

		const totals = new Map<number, Totals>();
		for (const r of totalsRows) totals.set(r.accountId, { debits: r.debits, credits: r.credits });

		// 4) Attach balances to accounts
		const enriched = accounts.map((a) => {
			const prettyName = toTitleCase(a.name.toLowerCase());

			// Revenue/Expense → 0 for now (period-based later)
			if (a.type === "revenue" || a.type === "expense") {
				return { ...a, name: prettyName, balance: "0", rolledBalance: "0" };
			}

			const t = totals.get(a.id) ?? { debits: "0", credits: "0" };
			const bal = calcNormalBalance(a.normalBalance, t.debits, t.credits);

			return { ...a, name: prettyName, balance: bal, rolledBalance: bal };
		});

		// 5) Build tree + roll up
		return buildTreeWithRollup(enriched);
	});

export const getAccount = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator((accountId: number) => accountId)
	.handler(async ({ data: accountId }) => {
		await requirePermission("chart-of-accounts:view");
		return db.query.ledgerAccounts.findFirst({
			columns: { createdAt: false, updatedAt: false, normalBalance: false },
			with: { bank: { columns: { accountNumber: true } } },
			where: eq(ledgerAccounts.id, accountId),
		});
	});

export const getChildrenAccountByParentName = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator((parentName: string) => parentName)
	.handler(async ({ data: parentName }) => {
		const parentAccount = await db.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: eq(sql`lower(${ledgerAccounts.name})`, parentName.trim().toLowerCase()),
		});

		if (!parentAccount?.id) {
			throw new Error("Parent account not found");
		}

		return db.query.ledgerAccounts.findMany({
			columns: { id: true, name: true },
			where: eq(ledgerAccounts.parentId, parentAccount.id),
		});
	});

export const upsertAccount = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(accountsFormSchema)
	.handler(async ({ data, context }) => {
		if (data.id) {
			return updateAccount({ data, userId: context.user.id.toString() });
		}
		return createAccount({ data, userId: context.user.id.toString() });
	});

export const deleteAccount = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator((accountId: string) => accountId)
	.handler(async ({ data: accountId, context }) => {
		await requirePermission("chart-of-accounts:delete");

		const account = await getAccount({ data: Number(accountId) });

		if (!account) {
			return failure({ type: "NotFoundError", message: "Account not found" });
		}

		try {
			const hasChildAccounts = await db.query.ledgerAccounts.findFirst({
				where: eq(ledgerAccounts.parentId, Number(accountId)),
			});

			if (hasChildAccounts) {
				return failure({
					type: "ApplicationError",
					message: "Account has child accounts",
				});
			}

			const isBankAccount = await db.query.bankAccounts.findFirst({
				columns: { id: true },
				where: eq(bankAccounts.accountId, account.id),
			});

			await db.transaction(async (tx) => {
				if (isBankAccount) {
					await tx.delete(bankAccounts).where(eq(bankAccounts.id, isBankAccount.id));
				}

				await tx.delete(ledgerAccounts).where(eq(ledgerAccounts.id, Number(accountId)));

				await logActivity({
					data: {
						action: "delete account",
						userId: context.user.id,
						description: `Deleted account ${account.name}`,
					},
				});
			});

			return success(undefined);
		} catch (error) {
			console.error(error);
			return failure({
				type: "ApplicationError",
				message: "Could not delete account",
			});
		}
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
	.validator((account: string) => account)
	.handler(async ({ data: account }) => {
		const ledgerAccount = await db.query.ledgerAccounts.findFirst({
			columns: { id: true },
			where: (accounts, { eq }) =>
				eq(sql`lower(${accounts.name})`, account === "cash" ? "cash at hand" : "cash at bank"),
		});

		return ledgerAccount?.id;
	});
