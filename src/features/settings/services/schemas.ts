import { z } from "zod";
import { vatTypes } from "@/drizzle/schema";

export const settingsDataSchema = z.object({
	id: z.string().nullish(),
	logRetentionDays: z.number().min(1, { error: "Log retention days is required" }),
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
	vatAccountId: z.string().nullish(),
	autoCreateFinancialYear: z.boolean().nullish(),
	mpesaSettlementAccountId: z.coerce.number<number>().nullish(),
	// .transform((val) => (val === 0 ? null : val)),
});

export const biometricSettingsSchema = z.object({
	id: z.string().nullish(),
	baseUrl: z.string().trim().min(1, "Base URL is required").url(),
	username: z.string().trim().min(1, { error: "Username is required" }),
	password: z.string().min(1, { error: "Password is required" }),
	defaultDepartmentId: z.number().int().min(1, { error: "Default Department ID is required" }),
	authorizedAreaId: z.number().int().min(1, { error: "Authorized Area ID is required" }),
	unauthorizedAreaId: z.number().int().min(1, { error: "Unauthorized Area ID is required" }),
	deviceSerialNumber: z.string().nullish(),
	syncEnabled: z.boolean(),
	pollIntervalSeconds: z.number().int().positive({ error: "Poll interval must be greater than 0" }),
	batchSize: z.number().int().positive({ error: "Batch size must be greater than 0" }),
});

export type SettingsDataSchema = z.infer<typeof settingsDataSchema>;
export type SettingsNotificationSchema = z.infer<typeof settingsNotificationSchema>;
export type SecuritySchema = z.infer<typeof securitySchema>;
export type BillingSchema = z.infer<typeof billingSchema>;
export type BiometricSettingsSchema = z.infer<typeof biometricSettingsSchema>;
