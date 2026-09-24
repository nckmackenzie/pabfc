import { and, eq, lte } from "drizzle-orm";
import { memberMemberships } from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";

// A membership paid for ahead of its start date (a renewal before the current
// plan ends, or a manual receipt with a future start date) is stored as
// "pending" by finalizeMembershipPayment. It becomes due once its start date
// has been reached.
export function getDueMembershipConditions(today = new Date()) {
	return and(
		eq(memberMemberships.status, "pending"),
		lte(memberMemberships.startDate, dateFormat(today))
	);
}
