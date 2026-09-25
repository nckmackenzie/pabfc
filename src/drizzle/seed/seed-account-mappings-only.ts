/**
 * Seeds only the ledger account mappings.
 *
 * `pnpm db:seed` runs every seeder, which also inserts demo users, members and
 * attendance. To bind the posting roles to existing accounts and nothing else:
 *
 *   npx tsx ./src/drizzle/seed/seed-account-mappings-only.ts
 *
 * Idempotent, and never overwrites a mapping already chosen in the UI.
 */
import { seedLedgerAccountMappings } from "@/drizzle/seed/ledger-account-mappings";

seedLedgerAccountMappings()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
