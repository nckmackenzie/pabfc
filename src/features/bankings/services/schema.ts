import { z } from "zod";

export const bankPostingSchema = z.object({
	id: z.string().optional(),
	transactionDate: z.iso
		.date({
			error: (iss) => (iss.input ? "Invalid date" : "Date is required"),
		})
		.refine(
			(date) =>
				new Date(date).setHours(23, 59, 59, 999) <=
				new Date().setHours(23, 59, 59, 999),
			"Date cannot be in the future",
		),
	bankId: z.string().min(1, "Bank is required"),
	counterAccountId: z.string().min(1, "Counter account is required"),
	direction: z.enum(["credit", "debit"]),
	amount: z.number().positive("Amount must be positive"),
	reference: z.string().min(1, "Reference is required"),
	narration: z.string().min(1, "Narration is required"),
});

export const bankPostingClearenceFormSchema = z.object({
	bankingId: z.string().min(1, "Banking is required"),
	clearedAt: z.iso
		.date({
			error: (iss) => (iss.input ? "Invalid date" : "Date is required"),
		})
		.refine(
			(date) =>
				new Date(date).setHours(23, 59, 59, 999) <=
				new Date().setHours(23, 59, 59, 999),
			"Date cannot be in the future",
		),
});

export type BankPostingSchema = z.infer<typeof bankPostingSchema>;
export type BankPostingClearenceFormSchema = z.infer<
	typeof bankPostingClearenceFormSchema
>;
