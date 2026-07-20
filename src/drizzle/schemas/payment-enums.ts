import { pgEnum } from "drizzle-orm/pg-core";

// These payment enums live in their own module (rather than payments.ts) so that
// addons.ts can reference them at table-definition time without importing payments.ts
// eagerly. That keeps the payments <-> addons relation (each references the other's
// table) free of a module-initialization cycle.

export const paymentChannels = ["portal", "staff", "auto_renewal"] as const;
export type PaymentChannel = (typeof paymentChannels)[number];
export const paymentChannelEnum = pgEnum("payment_channel", paymentChannels);

export const paymentMethods = [
	"mpesa_stk",
	"mpesa_manual",
	"cash",
	"card",
	"bank_transfer",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const paymentMethodEnum = pgEnum("payment_method", paymentMethods);

export const paymentStatuses = [
	"pending",
	"completed",
	"failed",
	"cancelled",
	"refunded",
	"voided",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];
export const paymentStatusEnum = pgEnum("payment_status", paymentStatuses);
