import { and, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	ledgerAccounts,
	payrollAccountMappings,
} from "@/drizzle/schema";
import {
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLES,
	PAYROLL_DEFAULT_LEDGER_ACCOUNTS,
	PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES,
} from "@/features/payroll/lib/payroll-constants";

export async function seedPayrollAccountMappings() {
	try {
		console.log("🌱 Seeding payroll account mappings...");
		await db.transaction(async (tx) => {
			await tx
				.insert(ledgerAccounts)
				.values(
					PAYROLL_DEFAULT_LEDGER_ACCOUNTS.map((account) => ({
						code: account.code,
						name: account.name,
						description: account.description,
						type: account.type,
						normalBalance: account.normalBalance,
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
							PAYROLL_DEFAULT_LEDGER_ACCOUNTS.map((account) => account.code)
						)
					)
				);

			const accountsByCode = new Map(
				seededAccounts
					.filter((account) => account.code)
					.map((account) => [account.code as string, account.id])
			);

			const mappingValues = PAYROLL_ACCOUNT_ROLE_KEYS.map((role) => {
				const code = PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES[role];
				const accountId = accountsByCode.get(code);

				if (!accountId) {
					throw new Error(`Missing seeded ledger account ${code} for payroll role ${role}`);
				}

				return {
					role,
					accountId,
					description: PAYROLL_ACCOUNT_ROLES[role].description,
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
