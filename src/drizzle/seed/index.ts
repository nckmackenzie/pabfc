import { seedMemberData } from "@/drizzle/seed/members";
import { seedUsers } from "@/drizzle/seed/users";
import { seedAttendance } from "./attendance";
import { seedLeaveEntitlements } from "./leave-entitlements";
import { seedPublicHolidays } from "./public-holidays";

async function main() {
  console.log("🚀 Starting database seeding...");
  console.log("=".repeat(50));

  try {
    await Promise.all([
      seedUsers(),
      seedMemberData(),
      seedAttendance(),
      seedLeaveEntitlements(),
      seedPublicHolidays(),
      //   seedProducts(),
      //   seedCustomer(),
      //   seedStocksReceipts(),
      //   seedPurchases(),
    ]);

    console.log("=".repeat(50));
    console.log("🎉 Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("💥 Database seeding failed:", error);
    process.exit(1);
  }
}

main();
