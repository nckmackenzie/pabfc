import type { db } from "@/drizzle/db";
import { type EnquiryStatus, enquiries, members } from "@/drizzle/schema";
import { enquiryFullName } from "@/features/enquiries/lib/helpers";
import {
	memberByPhoneFilter,
	openEnquiryByPhoneFilter,
} from "@/features/enquiries/lib/query-filters";
import type { AppError } from "@/lib/result";

export type EnquiryDuplicates = {
	openEnquiry?: { id: string; name: string; status: EnquiryStatus };
	member?: { id: string; name: string; memberNo: number; deleted: boolean };
};

// A ConflictError that also says which open enquiry already holds the phone,
// so the UI can link to it. Extra fields survive server-fn serialisation.
export type EnquiryConflictError = Extract<AppError, { type: "ConflictError" }> & {
	existingEnquiryId?: string;
};

export function isEnquiryConflictError(error: unknown): error is EnquiryConflictError {
	return (
		typeof error === "object" &&
		error !== null &&
		"type" in error &&
		error.type === "ConflictError" &&
		"existingEnquiryId" in error &&
		typeof error.existingEnquiryId === "string"
	);
}

// Looks for an open enquiry and for a member holding this phone in any stored
// format. Members include soft-deleted rows because they keep their unique
// contact. Accepts a transaction so create/update can check atomically.
export async function findEnquiryDuplicates(
	executor: Pick<typeof db, "select">,
	{ phone, excludeEnquiryId }: { phone: string; excludeEnquiryId?: string }
): Promise<EnquiryDuplicates> {
	const result: EnquiryDuplicates = {};

	const openFilter = openEnquiryByPhoneFilter(phone, excludeEnquiryId);
	if (openFilter) {
		const [open] = await executor
			.select({
				id: enquiries.id,
				firstName: enquiries.firstName,
				lastName: enquiries.lastName,
				status: enquiries.status,
			})
			.from(enquiries)
			.where(openFilter)
			.limit(1);
		if (open) {
			result.openEnquiry = {
				id: open.id,
				name: enquiryFullName(open.firstName, open.lastName),
				status: open.status,
			};
		}
	}

	const memberFilter = memberByPhoneFilter(phone);
	if (memberFilter) {
		const rows = await executor
			.select({
				id: members.id,
				firstName: members.firstName,
				lastName: members.lastName,
				memberNo: members.memberNo,
				deletedAt: members.deletedAt,
			})
			.from(members)
			.where(memberFilter);
		// Prefer a live member over a soft-deleted one.
		const match = rows.find((row) => !row.deletedAt) ?? rows[0];
		if (match) {
			result.member = {
				id: match.id,
				name: enquiryFullName(match.firstName, match.lastName),
				memberNo: match.memberNo,
				deleted: Boolean(match.deletedAt),
			};
		}
	}

	return result;
}
