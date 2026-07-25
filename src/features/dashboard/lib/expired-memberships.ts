import { eq, gte, lte, sql } from "drizzle-orm";
import { memberMemberships } from "@/drizzle/schema";
import { getExpiredMembershipStatDates } from "@/features/dashboard/lib/helpers";
import { dateFormat } from "@/lib/helpers";

export function getExpiredMembershipConditions(today = new Date()) {
	const { periodStart, periodEnd } = getExpiredMembershipStatDates(today);

	return [
		gte(memberMemberships.endDate, dateFormat(periodStart)),
		lte(memberMemberships.endDate, dateFormat(periodEnd)),
		eq(memberMemberships.status, "expired"),
		sql`NOT EXISTS (
			SELECT 1
			FROM member_memberships mm_newer
			WHERE mm_newer.member_id = ${memberMemberships.memberId}
			AND mm_newer.start_date > ${memberMemberships.startDate}
			AND mm_newer.status IN (${"active"}, ${"pending"})
		)`,
	] as const;
}
