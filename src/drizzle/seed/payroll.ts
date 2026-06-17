import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { ledgerAccounts, payrollAccountMappings, statutoryRates } from "@/drizzle/schema";
import {
	AHL_EMPLOYEE_RATE,
	AHL_EMPLOYER_RATE,
	NITA_LEVY_PER_EMPLOYEE,
	NSSF_CONTRIBUTION_RATE,
	NSSF_MAX_EMPLOYEE,
	NSSF_MAX_EMPLOYER,
	NSSF_TIER_1_UPPER_LIMIT,
	NSSF_TIER_2_UPPER_LIMIT,
	PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES,
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLES,
	PAYROLL_DEFAULT_LEDGER_ACCOUNTS,
	PAYROLL_PARENT_LEDGER_ACCOUNTS,
	PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES,
	PAYE_BANDS,
	PAYE_INSURANCE_RELIEF_MAX,
	PAYE_INSURANCE_RELIEF_RATE,
	PAYE_MEAL_ALLOWANCE_EXEMPT,
	PAYE_MORTGAGE_ALLOWABLE_MAX,
	PAYE_NON_CASH_BENEFIT_EXEMPT,
	PAYE_PENSION_ALLOWABLE_MAX,
	PAYE_PERSONAL_RELIEF,
	PAYE_POST_RETIREMENT_MEDICAL_MAX,
	SHIF_MINIMUM_CONTRIBUTION,
	SHIF_RATE,
	STATUTORY_RATE_CATEGORY_KEYS,
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
						parentId:
							parentIdsByCode.get(PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES[account.code]) ?? null,
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
					throw new Error(`Missing payroll parent account for ledger account ${account.code}`);
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

			await tx.insert(payrollAccountMappings).values(mappingValues).onConflictDoNothing({
				target: payrollAccountMappings.role,
			});
		});
		console.log("✅ Payroll account mappings seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding payroll account mappings:", error);
		throw error;
	}
}

export async function seedPayrollStatutoryRates() {
	try {
		console.log("🌱 Seeding payroll statutory rates...");
		await db.transaction(async (tx) => {
			const existingCategories = await tx.query.statutoryRates.findMany({
				columns: {
					category: true,
				},
			});
			const existingCategorySet = new Set(existingCategories.map((row) => row.category));
			const values: Array<typeof statutoryRates.$inferInsert> = [];

			if (!existingCategorySet.has("paye_band")) {
				values.push(
					...PAYE_BANDS.map((band, index) => ({
						category: "paye_band" as const,
						label: `Band ${index + 1}`,
						effectiveFrom: "2025-07-01",
						effectiveTo: null,
						lowerBound: band.lowerBound.toFixed(2),
						upperBound: band.upperBound === null ? null : band.upperBound.toFixed(2),
						rate: band.rate.toFixed(6),
						fixedAmount: null,
						notes: "Finance Act 2025 / 2025-2026 tax year",
						createdBy: null,
					}))
				);
			}

			if (!existingCategorySet.has("personal_relief")) {
				values.push({
					category: "personal_relief",
					label: "Personal Relief 2025",
					effectiveFrom: "2025-07-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: PAYE_PERSONAL_RELIEF.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("insurance_relief")) {
				values.push({
					category: "insurance_relief",
					label: "Insurance Relief Rate",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: PAYE_INSURANCE_RELIEF_RATE.toFixed(6),
					fixedAmount: PAYE_INSURANCE_RELIEF_MAX.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("shif")) {
				values.push({
					category: "shif",
					label: "SHIF Rate Oct 2024",
					effectiveFrom: "2024-10-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: SHIF_RATE.toFixed(6),
					fixedAmount: SHIF_MINIMUM_CONTRIBUTION.toFixed(2),
					notes: "Replaced NHIF",
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("ahl_employee_rate")) {
				values.push({
					category: "ahl_employee_rate",
					label: "AHL Employee Rate 2024",
					effectiveFrom: "2024-03-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: AHL_EMPLOYEE_RATE.toFixed(6),
					fixedAmount: null,
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("ahl_employer_rate")) {
				values.push({
					category: "ahl_employer_rate",
					label: "AHL Employer Rate 2024",
					effectiveFrom: "2024-03-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: AHL_EMPLOYER_RATE.toFixed(6),
					fixedAmount: null,
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("nssf_contribution_rate")) {
				values.push({
					category: "nssf_contribution_rate",
					label: "NSSF Phase 3 Rate",
					effectiveFrom: "2025-02-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: NSSF_CONTRIBUTION_RATE.toFixed(6),
					fixedAmount: null,
					notes: "NSSF Act 2013 Phase 3 effective February 2025",
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("nssf_tier_1_upper_limit")) {
				values.push({
					category: "nssf_tier_1_upper_limit",
					label: "NSSF Tier I Upper Limit",
					effectiveFrom: "2025-02-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: NSSF_TIER_1_UPPER_LIMIT.toFixed(2),
					notes: "NSSF Phase 3",
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("nssf_tier_2_upper_limit")) {
				values.push({
					category: "nssf_tier_2_upper_limit",
					label: "NSSF Tier II Upper Limit",
					effectiveFrom: "2025-02-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: NSSF_TIER_2_UPPER_LIMIT.toFixed(2),
					notes: "NSSF Phase 3",
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("nssf_max_employee")) {
				values.push({
					category: "nssf_max_employee",
					label: "NSSF Max Employee",
					effectiveFrom: "2025-02-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: NSSF_MAX_EMPLOYEE.toFixed(2),
					notes: "NSSF Phase 3",
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("nssf_max_employer")) {
				values.push({
					category: "nssf_max_employer",
					label: "NSSF Max Employer",
					effectiveFrom: "2025-02-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: NSSF_MAX_EMPLOYER.toFixed(2),
					notes: "NSSF Phase 3",
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("nita")) {
				values.push({
					category: "nita",
					label: "NITA Flat Levy",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: NITA_LEVY_PER_EMPLOYEE.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("pension_cap")) {
				values.push({
					category: "pension_cap",
					label: "Pension Allowable Max",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: PAYE_PENSION_ALLOWABLE_MAX.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("mortgage_cap")) {
				values.push({
					category: "mortgage_cap",
					label: "Mortgage Interest Allowable Max",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: PAYE_MORTGAGE_ALLOWABLE_MAX.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("post_retirement_medical_cap")) {
				values.push({
					category: "post_retirement_medical_cap",
					label: "Post Retirement Medical Max",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: PAYE_POST_RETIREMENT_MEDICAL_MAX.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("non_cash_benefit_exempt")) {
				values.push({
					category: "non_cash_benefit_exempt",
					label: "Non-Cash Benefit Monthly Exempt",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: PAYE_NON_CASH_BENEFIT_EXEMPT.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (!existingCategorySet.has("meal_allowance_exempt")) {
				values.push({
					category: "meal_allowance_exempt",
					label: "Meal Allowance Monthly Exempt",
					effectiveFrom: "2020-01-01",
					effectiveTo: null,
					lowerBound: null,
					upperBound: null,
					rate: null,
					fixedAmount: PAYE_MEAL_ALLOWANCE_EXEMPT.toFixed(2),
					notes: null,
					createdBy: null,
				});
			}

			if (values.length > 0) {
				await tx.insert(statutoryRates).values(values);
			}

			const missingCategories = STATUTORY_RATE_CATEGORY_KEYS.filter(
				(category) =>
					!existingCategorySet.has(category) && !values.some((value) => value.category === category)
			);

			if (missingCategories.length > 0) {
				console.warn(
					`Skipping statutory seed categories with no baseline rows configured: ${missingCategories.join(", ")}`
				);
			}
		});
		console.log("✅ Payroll statutory rates seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding payroll statutory rates:", error);
		throw error;
	}
}
