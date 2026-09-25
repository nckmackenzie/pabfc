import type { ExtractTablesWithRelations } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/drizzle/db";
import type * as schema from "@/drizzle/schema";
import { ledgerAccountMappings } from "@/drizzle/schema";
import {
	LEDGER_ACCOUNT_ROLES,
	type LedgerAccountRole,
} from "@/features/coa/lib/account-roles";
import { ApplicationError } from "@/lib/error-handling/app-error";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

const MAPPINGS_PAGE = "Chart of Accounts › Account Mappings";

/**
 * Resolves the ledger account bound to a posting role.
 *
 * `ledger_account_mappings` is the source of truth, so this reads the mapped
 * `account_id` and never falls back to matching an account by name. That is the
 * whole point: renaming an account in the chart of accounts no longer repoints or
 * duplicates anything, because nothing resolves by name.
 *
 * An unmapped, inactive, non-posting, or wrongly-typed account throws rather than
 * posting somewhere plausible-but-wrong. A journal that silently lands in the wrong
 * account is far more expensive to unpick than a failed save.
 */
export async function resolveAccountRole(
	role: LedgerAccountRole,
	tx?: Transaction,
): Promise<number> {
	const connection = tx ?? db;
	const definition = LEDGER_ACCOUNT_ROLES[role];

	const mapping = await connection.query.ledgerAccountMappings.findFirst({
		columns: { accountId: true },
		where: eq(ledgerAccountMappings.role, role),
		with: {
			account: {
				columns: {
					id: true,
					name: true,
					type: true,
					isActive: true,
					isPosting: true,
				},
			},
		},
	});

	if (!mapping?.account) {
		throw new ApplicationError(
			`No ledger account is mapped to "${definition.label}". Set it under ${MAPPINGS_PAGE} before posting.`,
		);
	}

	const { account } = mapping;

	if (!account.isActive) {
		throw new ApplicationError(
			`The account mapped to "${definition.label}" (${account.name}) is inactive. Choose an active account under ${MAPPINGS_PAGE}.`,
		);
	}

	if (!account.isPosting) {
		throw new ApplicationError(
			`The account mapped to "${definition.label}" (${account.name}) is not a posting account. Choose a posting account under ${MAPPINGS_PAGE}.`,
		);
	}

	if (account.type !== definition.requiredAccountType) {
		throw new ApplicationError(
			`The account mapped to "${definition.label}" (${account.name}) must be a ${definition.requiredAccountType} account, but it is ${account.type}. Correct it under ${MAPPINGS_PAGE}.`,
		);
	}

	return account.id;
}
