import { z } from "zod";
import { searchValidateSchema } from "@/lib/schema-rules";

export const planSchema = z
	.object({
		name: z.string().min(1, "Name is required"),
		duration: z.number().min(1, "Duration is required"),
		price: z.number().min(1, "Price is required"),
		description: z.string().nullish(),
		isSessionBased: z.boolean(),
		sessionCount: z.number().nullish(),
		active: z.boolean(),
		revenueAccountId: z.string({ error: "Revenue account is required" }),
	})
	.superRefine((data, ctx) => {
		if (
			data.isSessionBased &&
			(data.sessionCount === null ||
				data.sessionCount === undefined ||
				data.sessionCount < 1)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["sessionCount"],
				message: "Session count must be at least 1",
			});
		}
	});

export const planWithMembersValidateSearchSchema = searchValidateSchema.extend({
	memberStatus: z
		.enum(["active", "expired", "cancelled"])
		.optional()
		.catch("active"),
});

export type PlanSchema = z.infer<typeof planSchema>;

export type PlanWithMembersValidateSearchSchema = z.infer<
	typeof planWithMembersValidateSearchSchema
>;
