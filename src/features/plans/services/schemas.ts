import { z } from "zod";
import { searchValidateSchema } from "@/lib/schema-rules";

export const planSchema = z
	.object({
		id: z.string().optional(),
		name: z.string().min(1, "Name is required"),
		duration: z.number().min(1, "Duration is required"),
		price: z.number().min(0, "Price cannot be negative"),
		memberCount: z.number().int().min(1, "Member count must be at least 1"),
		description: z.string().nullish(),
		isSessionBased: z.boolean(),
		sessionCount: z.number().nullish(),
		active: z.boolean(),
		// Nullable: a complimentary-only plan (price 0) never posts to the GL,
		// so it needs no revenue account. Every consumer of plan.revenueAccountId
		// already null-checks it (finalizeMembershipPayment, upgrade, credit notes).
		revenueAccountId: z.string().nullish(),
		lateUpgradeGraceDays: z
			.number()
			.int("Grace period must be a whole number of days")
			.min(0, "Grace period cannot be negative")
			.nullish(),
	})
	.superRefine((data, ctx) => {
		if (
			data.isSessionBased &&
			(data.sessionCount === null || data.sessionCount === undefined || data.sessionCount < 1)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["sessionCount"],
				message: "Session count must be at least 1",
			});
		}
		if (data.price > 0 && !data.revenueAccountId) {
			ctx.addIssue({
				code: "custom",
				path: ["revenueAccountId"],
				message: "Revenue account is required for plans with a price above zero",
			});
		}
	});

export const planWithMembersValidateSearchSchema = searchValidateSchema.extend({
	memberStatus: z.enum(["active", "expired", "cancelled"]).optional().catch("active"),
});

export type PlanSchema = z.infer<typeof planSchema>;

export type PlanWithMembersValidateSearchSchema = z.infer<
	typeof planWithMembersValidateSearchSchema
>;
