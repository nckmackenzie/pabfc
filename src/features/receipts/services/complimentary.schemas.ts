import { z } from "zod";
import { requiredStringNonLowerSchemaEntry } from "@/lib/schema-rules";

export const complimentaryRequestSchema = z.object({
	memberId: requiredStringNonLowerSchemaEntry("Member is required"),
	planId: requiredStringNonLowerSchemaEntry("Plan is required"),
	startDate: z.iso.date({ error: "Start date is required" }),
	numberOfPeriods: z
		.number()
		.int({ error: "Must be a whole number" })
		.min(1, { error: "Must be at least 1" }),
	reason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});
export type ComplimentaryRequestSchema = z.infer<typeof complimentaryRequestSchema>;

export const rejectComplimentaryRequestSchema = z.object({
	requestId: requiredStringNonLowerSchemaEntry("Request is required"),
	rejectionReason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});
export type RejectComplimentaryRequestSchema = z.infer<typeof rejectComplimentaryRequestSchema>;

export const complimentaryRequestsSearchSchema = z.object({
	status: z.enum(["all", "pending", "approved", "rejected"]).optional().catch("all"),
});
export type ComplimentaryRequestsSearchSchema = z.infer<typeof complimentaryRequestsSearchSchema>;
