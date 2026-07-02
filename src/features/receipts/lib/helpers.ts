import { addDays } from "date-fns";
import type { MembershipStatus } from "@/drizzle/schema";

const NON_BLOCKING_STATUSES = ["cancelled", ""] as const;

export function membershipRangeConflicts({
	status,
	existingStart,
	existingEnd,
	newStart,
	newEnd,
}: {
	status: MembershipStatus;
	existingStart: string;
	existingEnd: string | null;
	newStart: string;
	newEnd: string;
}): boolean {
	if (NON_BLOCKING_STATUSES.includes(status as (typeof NON_BLOCKING_STATUSES)[number])) {
		return false;
	}
	const existingEndsAt = existingEnd ?? "9999-12-31";
	return existingStart <= newEnd && existingEndsAt >= newStart;
}

export function computeMembershipEndDate(
	startDate: Date | string,
	planDurationDays: number,
	numberOfPeriods: number
): Date {
	return addDays(new Date(startDate), planDurationDays * numberOfPeriods);
}
