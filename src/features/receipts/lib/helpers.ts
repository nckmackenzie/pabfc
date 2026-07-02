import { addDays, parseISO } from "date-fns";
import type { MembershipStatus } from "@/drizzle/schema";

// "yyyy-MM-dd" strings must go through parseISO (interpreted as local midnight),
// not `new Date(str)` (interpreted as UTC midnight) — the latter can shift the
// calendar date by a day once converted to local time in non-UTC timezones.
export function parseCalendarDate(value: Date | string): Date {
	return typeof value === "string" ? parseISO(value) : value;
}

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
	return addDays(parseCalendarDate(startDate), planDurationDays * numberOfPeriods);
}
