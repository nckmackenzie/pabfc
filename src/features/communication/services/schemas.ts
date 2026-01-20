import { z } from "zod";
import { FILTER_CRITERIA } from "@/drizzle/schema";

export const templateFormSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, { error: "Name is required" }),
	content: z.string().min(1, { error: "Content is required" }),
	description: z.string().min(1, { error: "Description is required" }),
});

export const broadcastFormSchema = z
	.object({
		filterCriteria: z.enum(FILTER_CRITERIA, {
			error: "Filter criteria is required",
		}),
		criteria: z.string().nullish(),
		smsTemplateId: z.string().nullish(),
		content: z.string().min(1, { error: "Content is required" }),
		receipients: z.array(z.string()),
		smsBroadcastStatus: z.enum(["draft", "sent"], {
			error: "Status is required",
		}),
		submitType: z.enum(["SUBMIT", "SEND_TEST"]),
	})
	.superRefine((data, ctx) => {
		if (
			data.filterCriteria === "specific members" &&
			!data.receipients?.length
		) {
			ctx.addIssue({
				code: "custom",
				path: ["receipients"],
				message: "At least one receipient is required",
			});
		}
		if (
			(data.filterCriteria === "by status" ||
				data.filterCriteria === "by plan") &&
			!data.criteria
		) {
			ctx.addIssue({
				code: "custom",
				path: ["criteria"],
				message: "Criteria is required",
			});
		}
	});

export type TemplateFormSchema = z.infer<typeof templateFormSchema>;
export type BroadcastFormSchema = z.infer<typeof broadcastFormSchema>;
