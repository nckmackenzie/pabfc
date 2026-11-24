import { normalizeKenyanPhone } from "@/lib/phone";

export function emptyToNull(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

export function enquiryFullName(firstName: string, lastName?: string | null) {
	return [firstName, lastName]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");
}

type EnquiryTextInput = {
	firstName: string;
	lastName?: string | null;
	phone: string;
	email?: string | null;
	sourceNotes?: string | null;
	notes?: string | null;
	interestedPlanId?: string | null;
	assignedEmployeeId?: string | null;
	followUpDate?: string | null;
};

// Trims strings, collapses empty ones to null and canonicalises the phone.
// The phone comes back null when it isn't a valid Kenyan mobile number.
export function normalizeEnquiryValues(input: EnquiryTextInput) {
	return {
		firstName: input.firstName.trim(),
		lastName: emptyToNull(input.lastName),
		phone: normalizeKenyanPhone(input.phone),
		email: emptyToNull(input.email)?.toLowerCase() ?? null,
		sourceNotes: emptyToNull(input.sourceNotes),
		notes: emptyToNull(input.notes),
		interestedPlanId: emptyToNull(input.interestedPlanId),
		assignedEmployeeId: emptyToNull(input.assignedEmployeeId),
		followUpDate: emptyToNull(input.followUpDate),
	};
}

// smsConsentAt is stamped when consent is first ticked, kept while it stays
// ticked, and cleared when it is unticked.
export function resolveSmsConsentAt({
	consent,
	existing,
	now = new Date(),
}: {
	consent: boolean;
	existing?: { smsConsent: boolean; smsConsentAt: Date | null } | null;
	now?: Date;
}): Date | null {
	if (!consent) return null;
	if (existing?.smsConsent && existing.smsConsentAt) return existing.smsConsentAt;
	return now;
}
