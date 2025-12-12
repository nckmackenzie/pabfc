import { createServerFn } from "@tanstack/react-start";
import { nanoid } from "nanoid";
import { db } from "@/drizzle/db";
import { settings } from "@/drizzle/schema";
import {
	billingSchema,
	securitySchema,
	settingsDataSchema,
	settingsNotificationSchema,
} from "@/features/settings/services/schemas";
import { AuthorizationError } from "@/lib/error-handling/app-error";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

function nullifyZeroValues(value: number | undefined | null) {
	if (value) {
		return +value === 0 ? undefined : value;
	}
	return undefined;
}

export const getSettings = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context: { user } }) => {
		if (user.role !== "admin") {
			throw new AuthorizationError(
				"You do not have permission to perform this action",
			);
		}
		return await db.query.settings.findFirst({
			columns: {
				createdAt: false,
				updatedAt: false,
				createdBy: false,
				updatedBy: false,
			},
		});
	});

export const upsertDataSettings = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(settingsDataSchema)
	.handler(async ({ data, context: { user } }) => {
		if (user.role !== "admin") {
			throw new AuthorizationError(
				"You do not have permission to perform this action",
			);
		}

		await db
			.insert(settings)
			.values({
				id: data.id ?? nanoid(),
				data: {
					logRetentionDays: data.logRetentionDays,
					inactiveMemberDays: nullifyZeroValues(data.inactiveMemberDays),
					inactiveMemberDeleteDays: nullifyZeroValues(
						data.inactiveMemberDeleteDays,
					),
					inactiveUserDays: nullifyZeroValues(data.inactiveUserDays),
					inactiveUserDeleteDays: nullifyZeroValues(
						data.inactiveUserDeleteDays,
					),
				},
				createdBy: user.id,
			})
			.onConflictDoUpdate({
				target: settings.id,
				set: {
					data: {
						inactiveMemberDays: nullifyZeroValues(data.inactiveMemberDays),
						inactiveMemberDeleteDays: nullifyZeroValues(
							data.inactiveMemberDeleteDays,
						),
						inactiveUserDays: nullifyZeroValues(data.inactiveUserDays),
						inactiveUserDeleteDays: nullifyZeroValues(
							data.inactiveUserDeleteDays,
						),
						logRetentionDays: data.logRetentionDays,
					},
					updatedBy: user.id,
				},
			});

		await logActivity({
			data: {
				action: data.id ? "Update Settings" : "Create Settings",
				description: data.id
					? "Updated data settings"
					: "Created data settings",
				userId: user.id,
			},
		});
		return "Settings updated successfully!!";
	});

export const upsertNotificationSettings = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(settingsNotificationSchema)
	.handler(async ({ data, context: { user } }) => {
		if (user.role !== "admin") {
			throw new AuthorizationError(
				"You do not have permission to perform this action",
			);
		}

		await db
			.insert(settings)
			.values({
				id: data.id ?? nanoid(),
				notification: {
					enableSmsNotifications: data.enableSmsNotifications ?? false,
					daysBeforeRenewalReminder: nullifyZeroValues(
						data.daysBeforeRenewalReminder,
					),
					sendPaymentReceiptByEmail:
						data.sendPaymentReceiptViaEmail ?? undefined,
				},
				createdBy: user.id,
			})
			.onConflictDoUpdate({
				target: settings.id,
				set: {
					notification: {
						enableSmsNotifications: data.enableSmsNotifications ?? false,
						daysBeforeRenewalReminder: nullifyZeroValues(
							data.daysBeforeRenewalReminder,
						),
						sendPaymentReceiptByEmail:
							data.sendPaymentReceiptViaEmail ?? undefined,
					},
					updatedBy: user.id,
				},
			});

		await logActivity({
			data: {
				action: data.id ? "Update Settings" : "Create Settings",
				description: data.id
					? "Updated notification settings"
					: "Created notification settings",
				userId: user.id,
			},
		});
		return "Settings updated successfully!!";
	});

export const upsertSecuritySettings = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(securitySchema)
	.handler(async ({ data, context: { user } }) => {
		if (user.role !== "admin") {
			throw new AuthorizationError(
				"You do not have permission to perform this action",
			);
		}

		await db
			.insert(settings)
			.values({
				id: data.id ?? nanoid(),
				security: {
					require2FaStaff: data.require2FaStaff ?? false,
					lockAfterAttempts: nullifyZeroValues(data.lockAfterAttempts),
					lockDurationMinutes: nullifyZeroValues(data.lockDurationMinutes),
				},
				createdBy: user.id,
			})
			.onConflictDoUpdate({
				target: settings.id,
				set: {
					security: {
						require2FaStaff: data.require2FaStaff ?? false,
						lockAfterAttempts: nullifyZeroValues(data.lockAfterAttempts),
						lockDurationMinutes: nullifyZeroValues(data.lockDurationMinutes),
					},
					updatedBy: user.id,
				},
			});

		await logActivity({
			data: {
				action: data.id ? "Update Settings" : "Create Settings",
				description: data.id
					? "Updated security settings"
					: "Created security settings",
				userId: user.id,
			},
		});
		return "Settings updated successfully!!";
	});

export const upsertBillingSettings = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(billingSchema)
	.handler(async ({ data, context: { user } }) => {
		if (user.role !== "admin") {
			throw new AuthorizationError(
				"You do not have permission to perform this action",
			);
		}

		await db
			.insert(settings)
			.values({
				id: data.id ?? nanoid(),
				billing: {
					invoicePrefix: data.invoicePrefix ?? undefined,
					invoiceNumberPadding: data.invoiceNumberPadding ?? undefined,
					applyTaxToMembership: data.applyTaxToMembership ?? false,
					vatType: data.vatType ?? undefined,
					vatAccountId: data.vatAccountId
						? Number(data.vatAccountId)
						: undefined,
				},
				createdBy: user.id,
			})
			.onConflictDoUpdate({
				target: settings.id,
				set: {
					billing: {
						invoicePrefix: data.invoicePrefix ?? undefined,
						invoiceNumberPadding: data.invoiceNumberPadding ?? undefined,
						applyTaxToMembership: data.applyTaxToMembership ?? false,
						vatType: data.vatType ?? undefined,
						vatAccountId: data.vatAccountId
							? Number(data.vatAccountId)
							: undefined,
					},
					updatedBy: user.id,
				},
			});

		await logActivity({
			data: {
				action: data.id ? "Update Settings" : "Create Settings",
				description: data.id
					? "Updated security settings"
					: "Created security settings",
				userId: user.id,
			},
		});
		return "Settings updated successfully!!";
	});
