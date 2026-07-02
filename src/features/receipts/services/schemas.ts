import { z } from "zod";
import { DISCOUNT_TYPES } from "@/drizzle/schema";

export const paymentSchema = z.object({
	memberId: z.string().min(1, { error: "Member is required" }),
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
export type PaymentsSearchValidateSchema = z.infer<
	typeof paymentsSearchValidateSchema
>;
