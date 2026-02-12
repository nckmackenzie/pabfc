import { z } from "zod";
import { BILL_STATUS, vatTypes } from "@/drizzle/schema";

export const billSchema = z
	.object({
		id: z.string().optional(),
		invoiceNo: z.string().min(1, "Invoice number is required"),
		vendorId: z.string().min(1, "Vendor is required"),
		invoiceDate: z.iso.date({ error: "Invoice Date is required" }),
		terms: z.string().nullish(),
		dueDate: z.iso.date().nullish(),
		isRecurring: z.boolean(),
		recurrencePattern: z
			.enum(["daily", "weekly", "monthly", "yearly"])
			.nullish(),
		recurrenceEndDate: z.iso.date().nullish(),
		notes: z.string().nullish(),
		lines: z.array(
			z.object({
				id: z.string().min(1, "Line ID is required"),
				expenseAccountId: z.string().min(1, "Expense Account is required"),
				description: z.string().min(1, "Description is required"),
				vatType: z.enum(vatTypes).nullish(),
				amount: z.number().positive("Amount must be positive"),
				// unitPrice: z.number().positive("Unit Price must be positive"),
				// quantity: z.number().positive("Quantity must be positive"),
			}),
		),
	})
	.superRefine((data, ctx) => {
		if (data.isRecurring) {
			if (!data.recurrencePattern) {
				ctx.addIssue({
					code: "custom",
					message: "Recurrence Pattern is required",
					path: ["recurrencePattern"],
				});
			}
		}
		if (data.dueDate && data.invoiceDate) {
			if (
				new Date(data.dueDate).setHours(0, 0, 0, 0) <
				new Date(data.invoiceDate).setHours(0, 0, 0, 0)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Due Date must be after Invoice Date",
					path: ["dueDate"],
				});
			}
		}
	});

export const supplierSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, "Name is required"),
	email: z.string().nullish(),
	phone: z.string().nullish(),
	address: z.string().nullish(),
	taxPin: z.string().nullish(),
	active: z.boolean(),
});

export const billValidateSearch = z
	.object({
		q: z.string().optional().catch(""),
		status: z.enum(["all", ...BILL_STATUS]).catch("all"),
	})
	.optional();

export type BillSchema = z.infer<typeof billSchema>;
export type SupplierSchema = z.infer<typeof supplierSchema>;
