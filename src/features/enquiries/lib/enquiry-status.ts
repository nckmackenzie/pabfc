import type { EnquiryStatus } from "@/drizzle/schema";

// Transitions staff can make by hand. `registered` and `converted` are absent
// on purpose: only the conversion flow (Part 2) may set them.
const MANUAL_TRANSITIONS: Record<EnquiryStatus, readonly EnquiryStatus[]> = {
	new: ["contacted", "lost"],
	contacted: ["lost"],
	registered: [],
	converted: [],
	lost: ["contacted"],
};

export function allowedManualTransitions(status: EnquiryStatus): EnquiryStatus[] {
	return [...MANUAL_TRANSITIONS[status]];
}

export function canTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
	return MANUAL_TRANSITIONS[from].includes(to);
}

// Statuses that only the conversion flow produces; also what makes an
// enquiry undeletable.
export function isConversionStatus(status: EnquiryStatus): boolean {
	return status === "registered" || status === "converted";
}
