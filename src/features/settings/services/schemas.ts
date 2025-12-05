import { z } from "zod";
import { vatTypes } from "@/drizzle/schema";

export const settingsDataSchema = z.object({
	id: z.string().nullish(),
	logRetentionDays: z
		.number()
		.min(1, { error: "Log retention days is required" }),
	inactiveUserDays: z.number().nullish(),
	inactiveUserDeleteDays: z.number().nullish(),
	inactiveMemberDays: z.number().nullish(),
	inactiveMemberDeleteDays: z.number().nullish(),
});

export const settingsNotificationSchema = z.object({
	id: z.string().nullish(),
	enableSmsNotifications: z.boolean().nullish(),
	daysBeforeRenewalReminder: z.number().nullish(),
	sendPaymentReceiptViaEmail: z.boolean().nullish(),
});

export const securitySchema = z
	.object({
		id: z.string().nullish(),
		require2FaStaff: z.boolean().nullish(),
		lockAfterAttempts: z.number().nullish(),
		lockDurationMinutes: z.number().nullish(),
	})
	.superRefine((data, ctx) => {
		if (data.lockAfterAttempts && !data.lockDurationMinutes) {
			ctx.addIssue({
				code: "custom",
				message: "Lock duration minutes is required",
				path: ["lockDurationMinutes"],
			});
		}
		if (data.lockDurationMinutes && !data.lockAfterAttempts) {
			ctx.addIssue({
				code: "custom",
				message: "Lock after attempts is required",
				path: ["lockAfterAttempts"],
			});
		}
	});

export const billingSchema = z.object({
	id: z.string().nullish(),
	invoicePrefix: z.string().nullish(),
	invoiceNumberPadding: z.number().nullish(),
	applyTaxToMembership: z.boolean().nullish(),
	vatType: z.enum(vatTypes).nullish(),
});

export type SettingsDataSchema = z.infer<typeof settingsDataSchema>;
export type SettingsNotificationSchema = z.infer<
	typeof settingsNotificationSchema
>;
export type SecuritySchema = z.infer<typeof securitySchema>;
export type BillingSchema = z.infer<typeof billingSchema>;
