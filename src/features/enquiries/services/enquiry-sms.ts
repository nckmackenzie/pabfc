import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { db } from "@/drizzle/db";
import { type EnquiryStatus, enquiries } from "@/drizzle/schema";
import {
	buildEnquiryFilters,
	type EnquiryListFilters,
} from "@/features/enquiries/lib/query-filters";
import { toTitleCase } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import { nairobiToday } from "@/lib/nairobi-time";

// `converted` enquirers are members now and are reached through member broadcasts.
export const SMS_ELIGIBLE_ENQUIRY_STATUSES = [
	"new",
	"contacted",
	"registered",
	"lost",
] as const satisfies readonly EnquiryStatus[];

export type EnquirySmsInput = {
	// Specific enquiries (from the detail page or selected rows)...
	enquiryIds?: string[];
	// ...or everything matching the list filters. IDs win if both are given.
	filters?: EnquiryListFilters;
};

export type EnquirySmsRecipient = {
	id: string;
	firstName: string;
	lastName: string | null;
	phone: string;
};

export type EnquirySmsExcluded = {
	// Not subscribed to SMS (smsConsent = false).
	noConsent: number;
	// Status is converted (or otherwise outside the eligible set).
	ineligibleStatus: number;
	// Phone isn't a valid +254 mobile number.
	invalidPhone: number;
	// Requested by ID but no longer exists or was deleted.
	notFound: number;
};

export type EnquirySmsResolution = {
	eligible: EnquirySmsRecipient[];
	excluded: EnquirySmsExcluded;
};

type CandidateRow = EnquirySmsRecipient & { smsConsent: boolean; status: EnquiryStatus };

// ─── Pure rules ─────────────────────────────────────────────────────────────

// Splits candidates into who will be texted and why everyone else won't. Each
// candidate is counted once, under the first rule it fails: status, then
// consent, then phone. The phone is re-normalised defensively.
export function classifyEnquiryRecipients(
	rows: CandidateRow[],
	requestedIds?: string[]
): EnquirySmsResolution {
	const excluded: EnquirySmsExcluded = {
		noConsent: 0,
		ineligibleStatus: 0,
		invalidPhone: 0,
		notFound: 0,
	};
	const eligible: EnquirySmsRecipient[] = [];

	for (const row of rows) {
		if (!(SMS_ELIGIBLE_ENQUIRY_STATUSES as readonly string[]).includes(row.status)) {
			excluded.ineligibleStatus++;
		} else if (!row.smsConsent) {
			excluded.noConsent++;
		} else {
			const phone = normalizeKenyanPhone(row.phone);
			if (!phone) {
				excluded.invalidPhone++;
			} else {
				eligible.push({ id: row.id, firstName: row.firstName, lastName: row.lastName, phone });
			}
		}
	}

	if (requestedIds) {
		excluded.notFound = Math.max(0, new Set(requestedIds).size - rows.length);
	}

	return { eligible, excluded };
}

// Template variables for an enquirer: {firstName} and {lastName}. A missing
// last name becomes an empty string rather than the text "null".
export function buildEnquiryTemplateData(enquiry: {
	firstName: string;
	lastName: string | null;
}): Record<string, string> {
	return {
		firstName: toTitleCase(enquiry.firstName.toLowerCase()),
		lastName: enquiry.lastName ? toTitleCase(enquiry.lastName.toLowerCase()) : "",
	};
}

// ─── Queries ────────────────────────────────────────────────────────────────

// Who a send is aimed at, before consent and status are applied: the requested
// IDs, or the list filters. Deleted enquiries are never candidates.
export function enquirySmsCandidateFilter({ enquiryIds, filters }: EnquirySmsInput, today: string) {
	// Providing IDs, even an empty list, means "these enquiries only": an empty
	// list must match nobody rather than fall through to everyone.
	if (enquiryIds) {
		if (enquiryIds.length === 0) return sql`false`;
		return and(isNull(enquiries.deletedAt), inArray(enquiries.id, [...new Set(enquiryIds)]));
	}
	return and(...buildEnquiryFilters(filters ?? {}, today));
}

// The hard rule, applied again at send time: consented, not deleted, eligible
// status. Anyone who withdrew consent or was deleted since the send was queued
// falls out here.
export function eligibleEnquirySmsFilter() {
	return and(
		eq(enquiries.smsConsent, true),
		isNull(enquiries.deletedAt),
		inArray(enquiries.status, [...SMS_ELIGIBLE_ENQUIRY_STATUSES])
	);
}

export async function resolveEnquiryRecipients(
	executor: Pick<typeof db, "select">,
	input: EnquirySmsInput
): Promise<EnquirySmsResolution> {
	const rows = await executor
		.select({
			id: enquiries.id,
			firstName: enquiries.firstName,
			lastName: enquiries.lastName,
			phone: enquiries.phone,
			smsConsent: enquiries.smsConsent,
			status: enquiries.status,
		})
		.from(enquiries)
		.where(enquirySmsCandidateFilter(input, nairobiToday()));

	return classifyEnquiryRecipients(rows, input.enquiryIds);
}

// The filters worth recording for audit: drops defaults ("all") and blanks.
export function summarizeEnquirySmsFilters(
	filters: EnquiryListFilters & { assignedEmployeeId?: string }
) {
	const summary: Record<string, string> = {};
	for (const [key, value] of Object.entries(filters)) {
		if (typeof value === "string" && value !== "" && value !== "all") summary[key] = value;
	}
	return summary;
}
