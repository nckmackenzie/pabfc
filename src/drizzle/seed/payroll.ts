import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	ledgerAccounts,
	payrollAccountMappings,
} from "@/drizzle/schema";
import {
	PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES,
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLES,
	PAYROLL_DEFAULT_LEDGER_ACCOUNTS,
	PAYROLL_PARENT_LEDGER_ACCOUNTS,
	PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES,
} from "@/features/payroll/lib/payroll-constants";

const EXPLICIT_LOAN_RECEIVABLE_ACCOUNT = {
	code: "1150",
	name: "Employee Loans Receivable",
	description: "Receivable balance for employee loans disbursed by the company",
	type: "asset",
	normalBalance: "debit",
} as const;

const EXPLICIT_LOAN_RECEIVABLE_MAPPING = {
	role: "loans_receivable",
	code: "1150",
	description: PAYROLL_ACCOUNT_ROLES.loans_receivable.description,
} as const;

function getSeedLedgerAccounts() {
	const defaultAccounts = [...PAYROLL_DEFAULT_LEDGER_ACCOUNTS];
	const hasLoanReceivableAccount = defaultAccounts.some(
		(account) => account.code === EXPLICIT_LOAN_RECEIVABLE_ACCOUNT.code
	);

	if (!hasLoanReceivableAccount) {
		defaultAccounts.push(EXPLICIT_LOAN_RECEIVABLE_ACCOUNT);
	}

	return defaultAccounts;
}

function getSeedMappingRoles() {
	const roleKeys = [...PAYROLL_ACCOUNT_ROLE_KEYS];

	if (!roleKeys.includes(EXPLICIT_LOAN_RECEIVABLE_MAPPING.role)) {
		roleKeys.push(EXPLICIT_LOAN_RECEIVABLE_MAPPING.role);
	}

	return roleKeys;
}

export async function seedPayrollAccountMappings() {
	try {
		console.log("🌱 Seeding payroll account mappings...");
		await db.transaction(async (tx) => {
			const seedLedgerAccounts = getSeedLedgerAccounts();
			const seedMappingRoles = getSeedMappingRoles();

			await tx
				.insert(ledgerAccounts)
				.values(
					PAYROLL_PARENT_LEDGER_ACCOUNTS.map((account) => ({
						code: account.code,
						name: account.name,
						description: account.description,
						type: account.type,
						normalBalance: account.normalBalance,
						parentId: null,
						isPosting: false,
						isActive: true,
					}))
				)
				.onConflictDoNothing({
					target: ledgerAccounts.code,
				});

			const parentAccounts = await tx
				.select({
					id: ledgerAccounts.id,
					code: ledgerAccounts.code,
				})
				.from(ledgerAccounts)
				.where(
					inArray(
						ledgerAccounts.code,
						PAYROLL_PARENT_LEDGER_ACCOUNTS.map((account) => account.code)
					)
				);

			const parentIdsByCode = new Map(
				parentAccounts
					.filter((account) => account.code)
					.map((account) => [account.code as string, account.id])
			);

			for (const parentAccount of PAYROLL_PARENT_LEDGER_ACCOUNTS) {
				const parentId = parentIdsByCode.get(parentAccount.code);
				const parentParentId = parentAccount.parentCode
					? parentIdsByCode.get(parentAccount.parentCode)
					: null;

				if (!parentId) {
					throw new Error(`Missing payroll parent ledger account ${parentAccount.code}`);
				}

				await tx
					.update(ledgerAccounts)
					.set({
						parentId: parentParentId ?? null,
						isPosting: false,
					})
					.where(eq(ledgerAccounts.id, parentId));
			}

			await tx
				.insert(ledgerAccounts)
				.values(
					seedLedgerAccounts.map((account) => ({
						code: account.code,
						name: account.name,
						description: account.description,
						type: account.type,
						normalBalance: account.normalBalance,
						parentId: parentIdsByCode.get(PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES[account.code]) ?? null,
						isPosting: true,
						isActive: true,
					}))
				)
				.onConflictDoNothing({
					target: ledgerAccounts.code,
				});

			const seededAccounts = await tx
				.select({
					id: ledgerAccounts.id,
					code: ledgerAccounts.code,
				})
				.from(ledgerAccounts)
				.where(
					and(
						inArray(
							ledgerAccounts.code,
							seedLedgerAccounts.map((account) => account.code)
						)
					)
				);

			const accountsByCode = new Map(
				seededAccounts
					.filter((account) => account.code)
					.map((account) => [account.code as string, account.id])
			);

			for (const account of seedLedgerAccounts) {
				const accountId = accountsByCode.get(account.code);
				const parentId = parentIdsByCode.get(PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES[account.code]);

				if (!accountId) {
					throw new Error(`Missing seeded ledger account ${account.code}`);
				}

				if (!parentId) {
					throw new Error(
						`Missing payroll parent account for ledger account ${account.code}`
					);
				}

				await tx
					.update(ledgerAccounts)
					.set({
						parentId,
						isPosting: true,
					})
					.where(eq(ledgerAccounts.id, accountId));
			}

			const mappingValues = seedMappingRoles.map((role) => {
				const code =
					role === EXPLICIT_LOAN_RECEIVABLE_MAPPING.role
						? EXPLICIT_LOAN_RECEIVABLE_MAPPING.code
						: PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES[role];
				const accountId = accountsByCode.get(code);

				if (!accountId) {
					throw new Error(`Missing seeded ledger account ${code} for payroll role ${role}`);
				}

				return {
					role,
					accountId,
					description:
						role === EXPLICIT_LOAN_RECEIVABLE_MAPPING.role
							? EXPLICIT_LOAN_RECEIVABLE_MAPPING.description
							: PAYROLL_ACCOUNT_ROLES[role].description,
				};
			});

			await tx
				.insert(payrollAccountMappings)
				.values(mappingValues)
				.onConflictDoNothing({
					target: payrollAccountMappings.role,
				});
		});
		console.log("✅ Payroll account mappings seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding payroll account mappings:", error);
		throw error;
	}
}
