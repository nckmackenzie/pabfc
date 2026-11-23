import type { EnquiryLostReason, EnquirySource, EnquiryStatus } from "@/drizzle/schema";

export const ENQUIRY_STATUS_OPTIONS: Array<{ value: EnquiryStatus; label: string }> = [
	{ value: "new", label: "New" },
	{ value: "contacted", label: "Contacted" },
	{ value: "registered", label: "Registered" },
	{ value: "converted", label: "Converted" },
	{ value: "lost", label: "Lost" },
];

export const ENQUIRY_SOURCE_OPTIONS: Array<{ value: EnquirySource; label: string }> = [
	{ value: "walk_in", label: "Walk-in" },
	{ value: "phone_call", label: "Phone call" },
	{ value: "whatsapp", label: "WhatsApp" },
	{ value: "instagram", label: "Instagram" },
	{ value: "facebook", label: "Facebook" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "google", label: "Google" },
	{ value: "website", label: "Website" },
	{ value: "referral", label: "Referral" },
	{ value: "flyer_signage", label: "Flyer / signage" },
	{ value: "other", label: "Other" },
];

export const ENQUIRY_LOST_REASON_OPTIONS: Array<{
	value: EnquiryLostReason;
	label: string;
}> = [
	{ value: "price", label: "Price" },
	{ value: "location", label: "Location" },
	{ value: "schedule", label: "Schedule" },
	{ value: "joined_other_gym", label: "Joined another gym" },
	{ value: "no_response", label: "No response" },
	{ value: "not_interested", label: "Not interested" },
	{ value: "other", label: "Other" },
];

export const FOLLOW_UP_FILTERS = ["all", "overdue", "today", "upcoming"] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

export const FOLLOW_UP_FILTER_OPTIONS: Array<{ value: FollowUpFilter; label: string }> = [
	{ value: "all", label: "Any follow-up" },
	{ value: "overdue", label: "Overdue" },
	{ value: "today", label: "Due today" },
	{ value: "upcoming", label: "Upcoming" },
];

function labelLookup<T extends string>(options: Array<{ value: T; label: string }>) {
	const labels = new Map<string, string>(options.map((option) => [option.value, option.label]));
	return (value: T | null | undefined) => (value ? (labels.get(value) ?? value) : "");
}

export const enquiryStatusLabel = labelLookup(ENQUIRY_STATUS_OPTIONS);
export const enquirySourceLabel = labelLookup(ENQUIRY_SOURCE_OPTIONS);
export const enquiryLostReasonLabel = labelLookup(ENQUIRY_LOST_REASON_OPTIONS);
