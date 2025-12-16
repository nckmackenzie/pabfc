import { z } from "zod";
import { PAYMENT_METHODS, vatTypes } from "@/drizzle/schema";

export const expenseSchema = z
	.object({
		expenseDate: z.iso.date({ error: "Select a valid date" }),
		expenseNo: z.number(),
		payeeId: z.string().min(1, { error: "Select Payee" }),
		paymentMethod: z.enum(PAYMENT_METHODS),
		reference: z.string().min(1, { error: "Enter Reference" }),
		details: z.array(
			z.object({
				accountId: z.string().min(1, { error: "Select Account" }),
				quantity: z
					.number()
					.min(1, { error: "Quantity must be greater than 0" }),
				unitPrice: z
					.number()
					.min(1, { error: "Unit Price must be greater than 0" }),
				vatType: z.enum(vatTypes),
				id: z.string(),
			}),
		),
	})
	.superRefine(({ expenseDate, paymentMethod, reference, details }, ctx) => {
		if (new Date(expenseDate) > new Date()) {
			ctx.addIssue({
				code: "custom",
				message: "Expense Date cannot be in the future",
				path: ["expenseDate"],
			});
		}
		if (paymentMethod !== "cash" && reference?.trim().length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Reference is required",
				path: ["reference"],
			});
		}
		if (!details.length) {
			ctx.addIssue({
				code: "custom",
				message: "At least one expense detail is required",
				path: ["details"],
			});
		}
	});

export const payeeSchema = z.object({
	name: z.string().min(1, { error: "Enter Payee Name" }),
});

export type ExpenseSchema = z.infer<typeof expenseSchema>;
export type PayeeSchema = z.infer<typeof payeeSchema>;
