import { between, sql } from "drizzle-orm";
import { memberMemberships } from "@/drizzle/schema";
import { getExpiringMembershipStatDates } from "@/features/dashboard/lib/helpers";
import { dateFormat } from "@/lib/helpers";

export function getExpiringMembershipConditions(today = new Date()) {
	const { periodStart, periodEnd } = getExpiringMembershipStatDates(today);

	return [
		between(memberMemberships.endDate, dateFormat(periodStart), dateFormat(periodEnd)),
		sql`NOT EXISTS (
			SELECT 1 FROM member_memberships mm_newer
			WHERE mm_newer.member_id = ${memberMemberships.memberId}
			AND mm_newer.id != ${memberMemberships.id}
			AND mm_newer.end_date > ${memberMemberships.endDate}
		)`,
	] as const;
}
