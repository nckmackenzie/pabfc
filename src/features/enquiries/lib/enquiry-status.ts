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

// Transitions only the conversion flow may make. Kept apart from the manual
// rules above so staff can never reach registered/converted by hand.
const SYSTEM_TRANSITIONS: Record<EnquiryStatus, readonly EnquiryStatus[]> = {
	new: ["registered", "converted"],
	contacted: ["registered", "converted"],
	registered: ["converted"],
	// A voided conversion payment puts the enquiry back to awaiting first payment.
	converted: ["registered"],
	lost: [],
};

export function canSystemTransition(from: EnquiryStatus, to: EnquiryStatus): boolean {
	return SYSTEM_TRANSITIONS[from].includes(to);
}

// Still being worked: the only statuses that can be converted or linked.
export function isOpenStatus(status: EnquiryStatus): boolean {
	return status === "new" || status === "contacted";
}
