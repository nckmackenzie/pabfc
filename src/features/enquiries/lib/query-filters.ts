import {
	and,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNull,
	lt,
	lte,
	ne,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import {
	type EnquirySource,
	type EnquiryStatus,
	enquiries,
	members,
	OPEN_ENQUIRY_STATUSES,
} from "@/drizzle/schema";
import type { FollowUpFilter } from "@/features/enquiries/lib/constants";
import { normalizeKenyanPhone, phoneMatchVariants } from "@/lib/phone";

export type EnquiryListFilters = {
	q?: string;
	status?: EnquiryStatus | "all";
	source?: EnquirySource | "all";
	assignedEmployeeId?: string;
	followUp?: FollowUpFilter;
	from?: string;
	to?: string;
};

// Nairobi is UTC+3 all year (no DST), so a calendar day maps to a fixed offset.
const NAIROBI_OFFSET = "+03:00";

export function nairobiDayBounds({ from, to }: { from?: string; to?: string }) {
	return {
		start: from ? new Date(`${from}T00:00:00.000${NAIROBI_OFFSET}`) : undefined,
		end: to ? new Date(`${to}T23:59:59.999${NAIROBI_OFFSET}`) : undefined,
	};
}

export const isOpenEnquiry = inArray(enquiries.status, [...OPEN_ENQUIRY_STATUSES]);

// Overdue / due today / upcoming only make sense for enquiries still being
// worked, so each variant also restricts to open statuses.
export function followUpFilter(
	followUp: FollowUpFilter | undefined,
	today: string
): SQL | undefined {
	switch (followUp) {
		case "overdue":
			return and(isOpenEnquiry, lt(enquiries.followUpDate, today));
		case "today":
			return and(isOpenEnquiry, eq(enquiries.followUpDate, today));
		case "upcoming":
			return and(isOpenEnquiry, gt(enquiries.followUpDate, today));
		default:
			return undefined;
	}
}

function searchFilter(q: string): SQL | undefined {
	const query = q.trim();
	if (!query) return undefined;

	const conditions: Array<SQL | undefined> = [
		ilike(enquiries.firstName, `%${query}%`),
		ilike(enquiries.lastName, `%${query}%`),
		ilike(sql`concat_ws(' ', ${enquiries.firstName}, ${enquiries.lastName})`, `%${query}%`),
		ilike(enquiries.phone, `%${query}%`),
		ilike(enquiries.email, `%${query}%`),
	];

	// Phones are stored as +254…, so "0712…" or "712…" must still find them.
	const canonical = normalizeKenyanPhone(query);
	if (canonical) {
		conditions.push(eq(enquiries.phone, canonical));
	} else if (/^[\d\s\-+()]+$/.test(query)) {
		const digits = query.replace(/\D/g, "").replace(/^(0|254)/, "");
		if (digits.length >= 3) {
			conditions.push(ilike(enquiries.phone, `%${digits}%`));
		}
	}

	return or(...conditions);
}

// All the list filters as SQL conditions. Deleted enquiries never appear.
export function buildEnquiryFilters(filters: EnquiryListFilters, today: string): Array<SQL> {
	const conditions: Array<SQL | undefined> = [isNull(enquiries.deletedAt)];

	if (filters.q) conditions.push(searchFilter(filters.q));
	if (filters.status && filters.status !== "all") {
		conditions.push(eq(enquiries.status, filters.status));
	}
	if (filters.source && filters.source !== "all") {
		conditions.push(eq(enquiries.source, filters.source));
	}
	if (filters.assignedEmployeeId && filters.assignedEmployeeId !== "all") {
		conditions.push(eq(enquiries.assignedEmployeeId, filters.assignedEmployeeId));
	}
	conditions.push(followUpFilter(filters.followUp, today));

	const { start, end } = nairobiDayBounds(filters);
	if (start) conditions.push(gte(enquiries.createdAt, start));
	if (end) conditions.push(lte(enquiries.createdAt, end));

	return conditions.filter((condition): condition is SQL => Boolean(condition));
}

// An open enquiry already holding this phone. Stored canonical, but matched
// through every variant for safety.
export function openEnquiryByPhoneFilter(
	phone: string,
	excludeEnquiryId?: string
): SQL | undefined {
	const variants = phoneMatchVariants(phone);
	if (variants.length === 0) return undefined;

	return and(
		inArray(enquiries.phone, variants),
		isOpenEnquiry,
		isNull(enquiries.deletedAt),
		excludeEnquiryId ? ne(enquiries.id, excludeEnquiryId) : undefined
	);
}

// Members are matched in every stored format and deliberately WITHOUT a
// deletedAt filter: a soft-deleted member still owns their unique contact.
export function memberByPhoneFilter(phone: string): SQL | undefined {
	const variants = phoneMatchVariants(phone);
	if (variants.length === 0) return undefined;
	return inArray(members.contact, variants);
}
