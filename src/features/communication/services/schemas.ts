import { z } from "zod";
import { FILTER_CRITERIA } from "@/drizzle/schema";

export const templateFormSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, { error: "Name is required" }),
	content: z.string().min(1, { error: "Content is required" }),
	description: z.string().min(1, { error: "Description is required" }),
});

export const broadcastFormSchema = z.object({
	filterCriteria: z.enum(FILTER_CRITERIA, {
		error: "Filter criteria is required",
	}),
	criteria: z.string().min(1, { error: "Criteria is required" }),
	smsTemplateId: z.string().nullish(),
	content: z.string().min(1, { error: "Content is required" }),
	receipients: z
		.array(z.string())
		.min(1, { error: "At least one receipient is required" }),
	smsBroadcastStatus: z.enum(["draft", "sent"], {
		error: "Status is required",
	}),
	submitType: z.enum(["SUBMIT", "SEND_TEST"]),
});

export type TemplateFormSchema = z.infer<typeof templateFormSchema>;
export type BroadcastFormSchema = z.infer<typeof broadcastFormSchema>;
