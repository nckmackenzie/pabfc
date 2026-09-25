import { eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { ledgerAccountMappings, ledgerAccounts } from "@/drizzle/schema";
import {
	LEDGER_ACCOUNT_ROLE_KEYS,
	LEDGER_ACCOUNT_ROLES,
} from "@/features/coa/lib/account-roles";

/**
 * Binds each posting role to the account it already uses, so the Account Mappings
 * page opens with everything configured instead of every role reading "Missing".
 *
 * Matching is by `code` first and then by `name`, because an account created by the
 * old lookup-or-create path may have a null code. Nothing is created here: a role
 * whose account does not exist is left unmapped for an admin to set, rather than
 * having an account invented behind their back.
 *
 * `onConflictDoNothing` on `role` makes this idempotent and, more importantly,
 * means it never overwrites a mapping an admin has already chosen — the table stays
 * the source of truth.
 */
export async function seedLedgerAccountMappings() {
	try {
		console.log("🌱 Seeding ledger account mappings...");

		const unmapped: Array<string> = [];

		for (const role of LEDGER_ACCOUNT_ROLE_KEYS) {
			const { defaultCode, defaultName, label, description } =
				LEDGER_ACCOUNT_ROLES[role];

			const account =
				(await db.query.ledgerAccounts.findFirst({
					columns: { id: true },
					where: eq(ledgerAccounts.code, defaultCode),
				})) ??
				(await db.query.ledgerAccounts.findFirst({
					columns: { id: true },
					where: eq(
						sql`lower(${ledgerAccounts.name})`,
						defaultName.toLowerCase(),
					),
				}));

			if (!account) {
				unmapped.push(`${label} (expected code ${defaultCode} or "${defaultName}")`);
				continue;
			}

			await db
				.insert(ledgerAccountMappings)
				.values({ role, accountId: account.id, description })
				.onConflictDoNothing({ target: ledgerAccountMappings.role });
		}

		if (unmapped.length > 0) {
			console.warn(
				`⚠️  No account found for: ${unmapped.join("; ")}. Set these under Chart of Accounts › Account Mappings before posting.`,
			);
		}

		console.log("✅ Ledger account mappings seeded successfully!");
	} catch (error) {
		console.error("❌ Error seeding ledger account mappings:", error);
		throw error;
	}
}
