import { z } from "zod";
import { DISCOUNT_TYPES } from "@/drizzle/schema";

export const paymentSchema = z.object({
	memberIds: z
		.array(z.string().min(1))
		.min(1, { error: "At least one member is required" }),
	planId: z.string().min(1, { error: "Plan is required" }),
	paymentDate: z.iso.date({ error: "Payment Date is required" }),
	startDate: z.iso.date({ error: "Start Date is required" }),
	numberOfPeriods: z
		.number()
		.int({ error: "Must be a whole number" })
		.min(1, { error: "Must be at least 1" }),
	amount: z.number().min(1, { error: "Amount is required" }),
	reference: z.string().min(1, { error: "Payment reference is required" }),
	accountReference: z.string().optional(),
	discountType: z.enum(DISCOUNT_TYPES),
	discount: z.number().nullish(),
	// Optional addons charged alongside the membership payment. VAT-exempt and
	// snapshotted into addon_invoice_lines at creation time.
	addonIds: z.array(z.string().min(1)).optional(),
});

// "Addon Only" mode — no membership plan involved. The member selector remains
// (drives the billing member and, for perMember addons, the multiplier), plus an
// independent period selector.
export const addonOnlyPaymentSchema = z.object({
	memberIds: z
		.array(z.string().min(1))
		.min(1, { error: "At least one member is required" }),
	addonIds: z
		.array(z.string().min(1))
		.min(1, { error: "At least one addon is required" }),
	paymentDate: z.iso.date({ error: "Payment Date is required" }),
	numberOfPeriods: z
		.number()
		.int({ error: "Must be a whole number" })
		.min(1, { error: "Must be at least 1" }),
	reference: z.string().min(1, { error: "Payment reference is required" }),
});

export const paymentsSearchValidateSchema = z.object({
	q: z.string().optional().catch(""),
	payment: z.string().optional().catch(""),
	channel: z.enum(["all", "portal", "staff"]).optional().catch("all"),
	status: z
		.enum(["all", "completed", "pending", "refunded", "failed"])
		.optional()
		.catch("all"),
});

export type PaymentSchema = z.infer<typeof paymentSchema>;
export type AddonOnlyPaymentSchema = z.infer<typeof addonOnlyPaymentSchema>;
export type PaymentsSearchValidateSchema = z.infer<
	typeof paymentsSearchValidateSchema
>;
