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
		isGuestPass: z.boolean(),
		// Sale window (Nairobi calendar dates). For guest passes it is also the
		// last day the pass can be used — see computeMembershipEndDateForPlan.
		validFrom: z.iso.date({ error: "Enter a valid date" }).nullish(),
		validTo: z.iso.date({ error: "Enter a valid date" }).nullish(),
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
		if (data.isSessionBased && data.memberCount !== 1) {
			ctx.addIssue({
				code: "custom",
				path: ["memberCount"],
				message: "Session-based plans must cover exactly one member",
			});
		}
		if (data.isGuestPass) {
			if (!data.isSessionBased) {
				ctx.addIssue({
					code: "custom",
					path: ["isSessionBased"],
					message: "Guest passes must be session-based",
				});
			}
			if (data.sessionCount !== 1) {
				ctx.addIssue({
					code: "custom",
					path: ["sessionCount"],
					message: "Guest passes must have exactly 1 session",
				});
			}
			if (data.memberCount !== 1) {
				ctx.addIssue({
					code: "custom",
					path: ["memberCount"],
					message: "Guest passes must cover exactly one member",
				});
			}
			if (data.price <= 0) {
				ctx.addIssue({
					code: "custom",
					path: ["price"],
					message: "Guest passes must have a price above zero",
				});
			}
			if (!data.validFrom) {
				ctx.addIssue({
					code: "custom",
					path: ["validFrom"],
					message: "Available from is required for guest passes",
				});
			}
			if (!data.validTo) {
				ctx.addIssue({
					code: "custom",
					path: ["validTo"],
					message: "Available to is required for guest passes",
				});
			}
		}
		if (data.validFrom && data.validTo && data.validTo < data.validFrom) {
			ctx.addIssue({
				code: "custom",
				path: ["validTo"],
				message: "Available to must be on or after Available from",
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
