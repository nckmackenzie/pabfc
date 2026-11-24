import type { db } from "@/drizzle/db";
import { activityLogs } from "@/drizzle/schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Written inside the caller's transaction so the log commits or rolls back
// together with the change it describes.
export function logEnquiryActivity(
	tx: Transaction,
	{ userId, action, description }: { userId: string; action: string; description: string }
) {
	return tx.insert(activityLogs).values({ userId, action, description });
}
