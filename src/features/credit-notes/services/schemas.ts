import { z } from "zod";

export const issueCreditNoteSchema = z.object({
	membershipId: z.string().min(1, { error: "Membership is required" }),
	reason: z
		.string()
		.trim()
		.min(5, { error: "Reason must be at least 5 characters" })
		// Also written into member_memberships.terminated_reason (varchar(255)).
		.max(255, { error: "Reason must be at most 255 characters" }),
	// Staff-editable override of the auto-suggested amount; server re-derives and
	// caps it (see checkCreditNoteEligibility) rather than trusting this outright.
	amount: z.number().min(0).optional(),
});
export type IssueCreditNoteSchema = z.infer<typeof issueCreditNoteSchema>;

export const creditNotesSearchValidateSchema = z.object({
	q: z.string().optional().catch(""),
	status: z
		.enum(["all", "active", "partially_redeemed", "fully_redeemed", "expired"])
		.optional()
		.catch("all"),
});
export type CreditNotesSearchValidateSchema = z.infer<typeof creditNotesSearchValidateSchema>;
