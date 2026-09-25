/**
 * Seeds only the permission catalogue.
 *
 * `pnpm db:seed` runs every seeder, which also inserts demo users, members and
 * attendance. When a release only adds new permission keys, run this instead:
 *
 *   npx tsx ./src/drizzle/seed/seed-permissions-only.ts
 *
 * Inserts are `onConflictDoNothing` on the permission key, so it is safe to
 * re-run and never touches permissions already granted to a role.
 */
import { seedPermissions } from "@/drizzle/seed/permissions";

seedPermissions()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
