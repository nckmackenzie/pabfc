import { z } from "zod";

export const addSessionUsageSchema = z.object({
	membershipId: z.string().min(1, "Membership is required"),
	usageDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Usage date must be yyyy-MM-dd" }),
	reason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});

export const waiveSessionUsageSchema = z.object({
	usageId: z.string().min(1, "Session usage record is required"),
	reason: z.string().trim().min(10, { error: "Reason must be at least 10 characters" }),
});

export type AddSessionUsageSchema = z.infer<typeof addSessionUsageSchema>;
export type WaiveSessionUsageSchema = z.infer<typeof waiveSessionUsageSchema>;
