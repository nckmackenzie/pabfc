import { z } from "zod";

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
});

export type PaymentSchema = z.infer<typeof paymentSchema>;
