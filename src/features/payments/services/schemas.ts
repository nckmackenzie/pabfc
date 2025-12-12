import { z } from "zod";
import { DISCOUNT_TYPES } from "@/drizzle/schema";

export const paymentSchema = z.object({
	memberId: z.string().min(1, { error: "Member is required" }),
	planId: z.string().min(1, { error: "Plan is required" }),
	paymentDate: z.iso.date({ error: "Payment Date is required" }),
	amount: z.number().min(1, { error: "Amount is required" }),
	phoneNumber: z
		.string()
		.min(1, { error: "Phone Number is required" })
		.regex(/254\d{9}/, { error: "Invalid phone number" }),
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
