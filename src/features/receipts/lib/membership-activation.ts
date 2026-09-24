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

// A membership that has already ended is expired straight after activation by
// the daily cron, so it must not restore the member's access.
export function getMemberIdsWithCurrentMemberships(
	activated: Array<{ memberId: string; endDate: string | null }>,
	today = new Date()
) {
	const todayDate = dateFormat(today);
	return [
		...new Set(
			activated
				.filter(({ endDate }) => endDate === null || endDate >= todayDate)
				.map(({ memberId }) => memberId)
		),
	];
}
