import { seedMemberData } from "@/drizzle/seed/members";
import { seedPayrollAccountMappings, seedPayrollStatutoryRates } from "@/drizzle/seed/payroll";
import { seedPermissions } from "@/drizzle/seed/permissions";
import { seedUsers } from "@/drizzle/seed/users";
import { seedAttendance } from "./attendance";
import { seedLeaveEntitlements } from "./leave-entitlements";
import { seedPublicHolidays } from "./public-holidays";

async function main() {
	console.log("🚀 Starting database seeding...");
	console.log("=".repeat(50));

	try {
		await seedPermissions();
		await seedUsers();
		await seedMemberData();
		await seedAttendance();
		await seedLeaveEntitlements();
		await seedPublicHolidays();
		await seedPayrollAccountMappings();
		await seedPayrollStatutoryRates();

		console.log("=".repeat(50));
		console.log("🎉 Database seeding completed successfully!");
		process.exit(0);
	} catch (error) {
		console.error("💥 Database seeding failed:", error);
		process.exit(1);
	}
}

main();
