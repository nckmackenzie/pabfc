import { z } from "zod";
import { ENQUIRY_LOST_REASONS, ENQUIRY_SOURCES, ENQUIRY_STATUSES } from "@/drizzle/schema";
import { FOLLOW_UP_FILTERS } from "@/features/enquiries/lib/constants";
import { isValidEmail, memberFormSchema } from "@/features/members/services/schemas";
import { normalizeKenyanPhone } from "@/lib/phone";

export const enquiryValidateSearch = z.object({
	q: z.string().optional().catch(""),
	status: z
		.enum(["all", ...ENQUIRY_STATUSES])
		.optional()
		.catch("all"),
	source: z
		.enum(["all", ...ENQUIRY_SOURCES])
		.optional()
		.catch("all"),
	assignedEmployeeId: z.string().optional().catch("all"),
	followUp: z.enum(FOLLOW_UP_FILTERS).optional().catch("all"),
	from: z.iso.date().optional().catch(undefined),
	to: z.iso.date().optional().catch(undefined),
});

// Strict on purpose: status and the conversion fields are not editable here,
// so a payload that tries to set them is rejected rather than silently stripped.
export const enquiryFormSchema = z
	.strictObject({
		id: z.string().optional(),
		firstName: z.string().trim().min(1, "First name is required").max(100),
		lastName: z.string().trim().max(100).nullish(),
		phone: z.string().trim().min(1, "Phone number is required"),
		email: z.string().trim().max(255).nullish(),
		source: z.enum(ENQUIRY_SOURCES, { error: "Source is required" }),
		sourceNotes: z.string().trim().max(255).nullish(),
		interestedPlanId: z.string().nullish(),
		notes: z.string().nullish(),
		followUpDate: z.iso.date({ error: "Enter a valid follow-up date" }).nullish(),
		assignedEmployeeId: z.string().nullish(),
		smsConsent: z.boolean(),
		acknowledgeExistingMember: z.boolean().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.phone && !normalizeKenyanPhone(data.phone)) {
			ctx.addIssue({
				code: "custom",
				message: "Enter a valid Kenyan phone number, e.g. 0712 345 678",
				path: ["phone"],
			});
		}
		if (data.email && !isValidEmail(data.email)) {
			ctx.addIssue({
				code: "custom",
				message: "Enter a valid email address",
				path: ["email"],
			});
		}
	});

export const updateEnquiryStatusSchema = z
	.strictObject({
		id: z.string().min(1, "Enquiry is required"),
		status: z.enum(ENQUIRY_STATUSES),
		lostReason: z.enum(ENQUIRY_LOST_REASONS).nullish(),
		lostReasonNotes: z.string().trim().max(255).nullish(),
	})
	.superRefine((data, ctx) => {
		if (data.status === "lost" && !data.lostReason) {
			ctx.addIssue({
				code: "custom",
				message: "Lost reason is required",
				path: ["lostReason"],
			});
		}
	});

export const markLostFormSchema = z.object({
	lostReason: z.enum(ENQUIRY_LOST_REASONS, { error: "Select a lost reason" }),
	lostReasonNotes: z.string().trim().max(255).nullish(),
});

export const checkEnquiryDuplicatesSchema = z.object({
	phone: z.string(),
	excludeEnquiryId: z.string().optional(),
});

export type EnquiryValidateSearch = z.infer<typeof enquiryValidateSearch>;
export type EnquiryFormSchema = z.infer<typeof enquiryFormSchema>;
export type UpdateEnquiryStatusSchema = z.infer<typeof updateEnquiryStatusSchema>;
export type MarkLostFormSchema = z.infer<typeof markLostFormSchema>;
export type CheckEnquiryDuplicatesSchema = z.infer<typeof checkEnquiryDuplicatesSchema>;

export const convertEnquirySchema = z.object({
	enquiryId: z.string().min(1, "Enquiry is required"),
	member: memberFormSchema,
});

export const linkEnquiryToMemberSchema = z.object({
	enquiryId: z.string().min(1, "Enquiry is required"),
	memberId: z.string().min(1, "Member is required"),
});

export type ConvertEnquirySchema = z.infer<typeof convertEnquirySchema>;
export type LinkEnquiryToMemberSchema = z.infer<typeof linkEnquiryToMemberSchema>;
