import { z } from "zod";

export const billSchema = z.object({
	invoiceNo: z.string().min(1, "Invoice number is required"),
	vendorId: z.string().min(1, "Vendor is required"),
	invoiceDate: z.iso.date({ error: "Invoice Date is required" }),
	terms: z.enum(["Net 30", "Net 60", "Net 90", "Due on Receipt"]),
	dueDate: z.iso.date({ error: "Due Date is required" }).nullish(),
	isRecurring: z.boolean(),
	recurrencePattern: z.enum(["daily", "weekly", "monthly", "yearly"]).nullish(),
	recurrenceEndDate: z.iso
		.date({ error: "Recurrence End Date is required" })
		.nullish(),
	notes: z.string().nullish(),
	lines: z.array(
		z.object({
			id: z.string().min(1, "Line ID is required"),
			expenseAccountId: z.string().min(1, "Expense Account is required"),
			description: z.string().min(1, "Description is required"),
			unitPrice: z.number().positive("Unit Price must be positive"),
			quantity: z.number().positive("Quantity must be positive"),
			total: z.number().positive("Total must be positive"),
		}),
	),
});

export type BillSchema = z.infer<typeof billSchema>;
