import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { ledgerAccounts, payrollAccountMappings, type AccountType } from "@/drizzle/schema";
import {
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	PAYROLL_ACCOUNT_ROLES,
	type PayrollAccountRole,
} from "@/features/payroll/lib/payroll-constants";
import { updatePayrollAccountMappingSchema } from "@/features/payroll/services/account-mappings.schemas";
import { normalizeText } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { type AppError, failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type LedgerAccountSummary = Pick<
	typeof ledgerAccounts.$inferSelect,
	"id" | "code" | "name" | "type" | "normalBalance" | "isActive"
>;

type PayrollAccountMappingRecord = typeof payrollAccountMappings.$inferSelect;

type PayrollAccountMappingView = {
	account: LedgerAccountSummary | null;
	accountId: number | null;
	description: string | null;
	id: number | null;
	label: string;
	requiredAccountType: "asset" | "expense" | "liability";
	role: PayrollAccountRole;
	roleDescription: string;
};

type PayrollAccountMappingsSummary = {
	hasInvalidMappings: boolean;
	isConfigurationComplete: boolean;
	isComplete: boolean;
	items: PayrollAccountMappingView[];
	missingRoles: PayrollAccountRole[];
};

type PayrollAccountMappingUpdateResponse = {
	mapping: PayrollAccountMappingView;
	warnings: string[];
};

type PayrollAccountMappingValidation = {
	issues: string[];
	valid: boolean;
};

type PayrollMappingLookupError = AppError & {
	invalidRoles?: PayrollAccountRole[];
	missingRoles?: PayrollAccountRole[];
};

async function listExistingMappings() {
	return db.query.payrollAccountMappings.findMany({
		columns: {
			id: true,
			role: true,
			accountId: true,
			description: true,
		},
		orderBy: [asc(payrollAccountMappings.role)],
		with: {
			account: {
				columns: {
					id: true,
					code: true,
					name: true,
					type: true,
					normalBalance: true,
					isActive: true,
				},
			},
		},
	});
}

function isMappingInvalid(item: PayrollAccountMappingView) {
	return (
		item.accountId !== null &&
		(item.account?.isActive !== true || item.account.type !== item.requiredAccountType)
	);
}

function toMappingView(
	existingMappings: Array<
		Pick<PayrollAccountMappingRecord, "id" | "role" | "accountId" | "description"> & {
			account: LedgerAccountSummary | null;
		}
	>
): PayrollAccountMappingsSummary {
	const mappingByRole = new Map(existingMappings.map((mapping) => [mapping.role, mapping]));

	const items = PAYROLL_ACCOUNT_ROLE_KEYS.map((role) => {
		const mapping = mappingByRole.get(role);

		return {
			account: mapping?.account ?? null,
			accountId: mapping?.accountId ?? null,
			description:
				mapping === undefined ? PAYROLL_ACCOUNT_ROLES[role].description : mapping.description,
			id: mapping?.id ?? null,
			label: PAYROLL_ACCOUNT_ROLES[role].label,
			requiredAccountType: PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role],
			role,
			roleDescription: PAYROLL_ACCOUNT_ROLES[role].description,
		} satisfies PayrollAccountMappingView;
	});

	const missingRoles = items.filter((item) => item.accountId === null).map((item) => item.role);

	return {
		hasInvalidMappings: items.some(isMappingInvalid),
		isConfigurationComplete: missingRoles.length === 0 && !items.some(isMappingInvalid),
		items,
		isComplete: missingRoles.length === 0,
		missingRoles,
	};
}

function isAccountTypeValidForRole(role: PayrollAccountRole, accountType: AccountType) {
	return PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role] === accountType;
}

async function getAllAccountMappings(): Promise<PayrollAccountMappingsSummary> {
	return toMappingView(await listExistingMappings());
}

async function getAccountMappingsAsMap(): Promise<
	Result<Record<PayrollAccountRole, number>, PayrollMappingLookupError>
> {
	const mappings = await getAllAccountMappings();

	if (!mappings.isComplete) {
		return {
			success: false,
			error: {
				type: "ValidationError",
				message: `Payroll account mappings are incomplete. Missing roles: ${mappings.missingRoles.join(", ")}`,
				missingRoles: mappings.missingRoles,
			},
		};
	}

	const invalidRoles = mappings.items
		.filter(
			(item) =>
				item.accountId === null ||
				item.account?.isActive !== true ||
				item.account.type !== item.requiredAccountType
		)
		.map((item) => item.role);

	if (invalidRoles.length > 0) {
		return {
			success: false,
			error: {
				type: "ValidationError",
				message: `Payroll account mappings reference missing, inactive, or invalid account types. Invalid roles: ${invalidRoles.join(", ")}`,
				invalidRoles,
			},
		};
	}

	return success(
		mappings.items.reduce(
			(accumulator, item) => {
				accumulator[item.role] = item.accountId as number;
				return accumulator;
			},
			{} as Record<PayrollAccountRole, number>
		)
	);
}

async function validateAllMappingsExist(): Promise<PayrollAccountMappingValidation> {
	const mappings = await getAllAccountMappings();
	const issues: string[] = [];

	if (!mappings.isComplete) {
		issues.push(`Missing payroll account mappings: ${mappings.missingRoles.join(", ")}`);
	}

	for (const item of mappings.items) {
		if (item.accountId !== null && item.account?.isActive !== true) {
			issues.push(`Mapped account for ${item.label} is inactive or unavailable.`);
		}

		if (item.accountId !== null && item.account && item.account.type !== item.requiredAccountType) {
			issues.push(
				`Mapped account for ${item.label} must be an ${item.requiredAccountType} account.`
			);
		}
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}

async function updateAccountMapping({
	accountId,
	description,
	role,
}: z.infer<typeof updatePayrollAccountMappingSchema>): Promise<
	Result<PayrollAccountMappingUpdateResponse>
> {
	const account = await db.query.ledgerAccounts.findFirst({
		columns: {
			id: true,
			code: true,
			name: true,
			type: true,
			normalBalance: true,
			isActive: true,
			isPosting: true,
		},
		where: eq(ledgerAccounts.id, accountId),
	});

	if (!account || !account.isActive) {
		return failure({
			type: "ValidationError",
			message: "The selected ledger account does not exist or is inactive.",
		});
	}

	if (!account.isPosting) {
		return failure({
			type: "ValidationError",
			message: "The selected ledger account must be a posting account.",
		});
	}

	if (!isAccountTypeValidForRole(role, account.type)) {
		return failure({
			type: "ValidationError",
			message: `${PAYROLL_ACCOUNT_ROLES[role].label} must use a ${PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role]} account.`,
		});
	}

	const duplicateMappings = await db.query.payrollAccountMappings.findMany({
		columns: {
			role: true,
		},
		where: and(
			eq(payrollAccountMappings.accountId, accountId),
			ne(payrollAccountMappings.role, role)
		),
	});

	const warnings =
		duplicateMappings.length > 0
			? [
					`This ledger account is also mapped to ${duplicateMappings
						.map((mapping) => PAYROLL_ACCOUNT_ROLES[mapping.role].label)
						.join(", ")}.`,
				]
			: [];

	const normalizedDescription = normalizeText(description);

	const [upserted] = await db
		.insert(payrollAccountMappings)
		.values({
			role,
			accountId,
			description: normalizedDescription,
		})
		.onConflictDoUpdate({
			target: payrollAccountMappings.role,
			set: {
				accountId,
				description: normalizedDescription,
				updatedAt: new Date(),
			},
		})
		.returning({
			id: payrollAccountMappings.id,
			role: payrollAccountMappings.role,
			accountId: payrollAccountMappings.accountId,
			description: payrollAccountMappings.description,
		});

	return success({
		mapping: {
			account: {
				id: account.id,
				code: account.code,
				name: account.name,
				type: account.type,
				normalBalance: account.normalBalance,
				isActive: account.isActive,
			},
			accountId: upserted.accountId,
			description: upserted.description,
			id: upserted.id,
			label: PAYROLL_ACCOUNT_ROLES[role].label,
			requiredAccountType: PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role],
			role,
			roleDescription: PAYROLL_ACCOUNT_ROLES[role].description,
		},
		warnings,
	});
}

async function getPayrollMappingAccountOptions() {
	return db.query.ledgerAccounts.findMany({
		columns: {
			id: true,
			code: true,
			name: true,
			type: true,
			normalBalance: true,
			isActive: true,
		},
		where: and(
			eq(ledgerAccounts.isActive, true),
			eq(ledgerAccounts.isPosting, true),
			inArray(ledgerAccounts.type, ["asset", "expense", "liability"])
		),
		orderBy: [asc(ledgerAccounts.type), asc(ledgerAccounts.code), asc(ledgerAccounts.name)],
	});
}

async function requirePayrollAccountMappingsViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-account-mappings:view");
}

async function requirePayrollAccountMappingsUpdateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-account-mappings:update");
}

export const getAllAccountMappingsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollAccountMappingsViewAccess();
		return getAllAccountMappings();
	});

export const getPayrollMappingAccountOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollAccountMappingsViewAccess();
		return getPayrollMappingAccountOptions();
	});

export const validateAllMappingsExistFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollAccountMappingsViewAccess();
		return validateAllMappingsExist();
	});

export const getAccountMappingsAsMapFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollAccountMappingsViewAccess();
		return getAccountMappingsAsMap();
	});

export const updateAccountMappingFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updatePayrollAccountMappingSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollAccountMappingsUpdateAccess();
		const result = await updateAccountMapping(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "update payroll account mapping",
					description: `Updated payroll account mapping for ${PAYROLL_ACCOUNT_ROLES[data.role].label}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export type PayrollAccountMappingsResponse = Awaited<ReturnType<typeof getAllAccountMappingsFn>>;
export type PayrollAccountMappingListItem = PayrollAccountMappingsResponse["items"][number];
export type PayrollAccountMappingOptions = Awaited<
	ReturnType<typeof getPayrollMappingAccountOptionsFn>
>;
export type PayrollAccountMappingOption = PayrollAccountMappingOptions[number];
