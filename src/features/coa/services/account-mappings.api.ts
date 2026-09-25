import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
	type AccountType,
	ledgerAccountMappings,
	ledgerAccounts,
} from "@/drizzle/schema";
import {
	LEDGER_ACCOUNT_ROLE_KEYS,
	LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	LEDGER_ACCOUNT_ROLES,
	type LedgerAccountRole,
	type LedgerAccountRoleAccountType,
} from "@/features/coa/lib/account-roles";
import { updateLedgerAccountMappingSchema } from "@/features/coa/services/account-mappings.schemas";
import { normalizeText } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, type Result, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type LedgerAccountSummary = Pick<
	typeof ledgerAccounts.$inferSelect,
	"id" | "code" | "name" | "type" | "normalBalance" | "isActive" | "isPosting"
>;

type LedgerAccountMappingView = {
	account: LedgerAccountSummary | null;
	accountId: number | null;
	description: string | null;
	id: number | null;
	label: string;
	requiredAccountType: LedgerAccountRoleAccountType;
	role: LedgerAccountRole;
	roleDescription: string;
};

type LedgerAccountMappingsSummary = {
	hasInvalidMappings: boolean;
	isComplete: boolean;
	items: Array<LedgerAccountMappingView>;
	missingRoles: Array<LedgerAccountRole>;
};

type LedgerAccountMappingUpdateResponse = {
	mapping: LedgerAccountMappingView;
	warnings: Array<string>;
};

async function listExistingMappings() {
	return db.query.ledgerAccountMappings.findMany({
		columns: { id: true, role: true, accountId: true, description: true },
		orderBy: [asc(ledgerAccountMappings.role)],
		with: {
			account: {
				columns: {
					id: true,
					code: true,
					name: true,
					type: true,
					normalBalance: true,
					isActive: true,
					isPosting: true,
				},
			},
		},
	});
}

function isMappingInvalid(item: LedgerAccountMappingView) {
	return (
		item.accountId !== null &&
		(item.account?.isActive !== true ||
			item.account.isPosting !== true ||
			item.account.type !== item.requiredAccountType)
	);
}

/**
 * Every role in the catalogue, whether or not it has a mapping yet, so the page can
 * show an unmapped role as "Missing" rather than omitting it.
 */
function toMappingsSummary(
	existingMappings: Awaited<ReturnType<typeof listExistingMappings>>,
): LedgerAccountMappingsSummary {
	const mappingByRole = new Map(
		existingMappings.map((mapping) => [mapping.role, mapping]),
	);

	const items = LEDGER_ACCOUNT_ROLE_KEYS.map((role) => {
		const mapping = mappingByRole.get(role);

		return {
			account: mapping?.account ?? null,
			accountId: mapping?.accountId ?? null,
			description: mapping?.description ?? null,
			id: mapping?.id ?? null,
			label: LEDGER_ACCOUNT_ROLES[role].label,
			requiredAccountType: LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role],
			role,
			roleDescription: LEDGER_ACCOUNT_ROLES[role].description,
		} satisfies LedgerAccountMappingView;
	});

	const missingRoles = items
		.filter((item) => item.accountId === null)
		.map((item) => item.role);

	return {
		hasInvalidMappings: items.some(isMappingInvalid),
		isComplete: missingRoles.length === 0,
		items,
		missingRoles,
	};
}

function isAccountTypeValidForRole(
	role: LedgerAccountRole,
	accountType: AccountType,
) {
	return LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role] === accountType;
}

async function updateMapping({
	accountId,
	description,
	role,
}: z.infer<typeof updateLedgerAccountMappingSchema>): Promise<
	Result<LedgerAccountMappingUpdateResponse>
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
			message: `${LEDGER_ACCOUNT_ROLES[role].label} must use a ${LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role]} account.`,
		});
	}

	// Sharing one account across two roles is legal but almost always a mistake, so
	// it is surfaced as a warning rather than blocked.
	const duplicateMappings = await db.query.ledgerAccountMappings.findMany({
		columns: { role: true },
		where: and(
			eq(ledgerAccountMappings.accountId, accountId),
			ne(ledgerAccountMappings.role, role),
		),
	});

	const warnings =
		duplicateMappings.length > 0
			? [
					`This ledger account is also mapped to ${duplicateMappings
						.map((mapping) => LEDGER_ACCOUNT_ROLES[mapping.role].label)
						.join(", ")}.`,
				]
			: [];

	const normalizedDescription = normalizeText(description);

	const [upserted] = await db
		.insert(ledgerAccountMappings)
		.values({ role, accountId, description: normalizedDescription })
		.onConflictDoUpdate({
			target: ledgerAccountMappings.role,
			set: {
				accountId,
				description: normalizedDescription,
				updatedAt: new Date(),
			},
		})
		.returning({
			id: ledgerAccountMappings.id,
			role: ledgerAccountMappings.role,
			accountId: ledgerAccountMappings.accountId,
			description: ledgerAccountMappings.description,
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
				isPosting: account.isPosting,
			},
			accountId: upserted.accountId,
			description: upserted.description,
			id: upserted.id,
			label: LEDGER_ACCOUNT_ROLES[role].label,
			requiredAccountType: LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role],
			role,
			roleDescription: LEDGER_ACCOUNT_ROLES[role].description,
		},
		warnings,
	});
}

export const getLedgerAccountMappingsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("ledger-account-mappings:view");
		return toMappingsSummary(await listExistingMappings());
	});

export const getLedgerAccountMappingOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("ledger-account-mappings:view");
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
				inArray(ledgerAccounts.type, ["asset", "liability", "equity"]),
			),
			orderBy: [
				asc(ledgerAccounts.type),
				asc(ledgerAccounts.code),
				asc(ledgerAccounts.name),
			],
		});
	});

export const updateLedgerAccountMappingFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updateLedgerAccountMappingSchema)
	.handler(async ({ data, context }) => {
		await requirePermission("ledger-account-mappings:update");
		const result = await updateMapping(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "update ledger account mapping",
					description: `Mapped ${LEDGER_ACCOUNT_ROLES[data.role].label} to account id ${data.accountId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export type LedgerAccountMappingsResponse = Awaited<
	ReturnType<typeof getLedgerAccountMappingsFn>
>;
export type LedgerAccountMappingListItem =
	LedgerAccountMappingsResponse["items"][number];
export type LedgerAccountMappingOption = Awaited<
	ReturnType<typeof getLedgerAccountMappingOptionsFn>
>[number];
