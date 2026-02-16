import { z } from "zod";

export const paymentFormSchema = z
	.object({
		id: z.string().optional(),
		vendorId: z.string().min(1, "Vendor is required"),
		paymentNo: z.string().min(1, "Payment number is required"),
		paymentDate: z.iso.date({ error: "Invalid date" }),
		paymentMethod: z.enum(["cash", "mpesa", "bank", "cheque"], {
			error: "Payment method is required",
		}),
		reference: z.string().min(1, { error: "Reference is required" }),
		bankId: z.string().nullish(),
		memo: z.string().nullish(),
		cashEquivalentAccountId: z.string().nullish(),
		bills: z
			.array(
				z
					.object({
						selected: z.boolean(),
						invoiceNo: z.string(),
						invoiceDate: z.string(),
						dueDate: z.string().nullish(),
						total: z.number(),
						balance: z.number(),
						billId: z.string().min(1, { error: "Bill is required" }),
						amount: z.number().nullish(),
					})
					.superRefine((data, ctx) => {
						if (data.selected && !data.amount) {
							ctx.addIssue({
								code: "custom",
								message: "Amount is required",
								path: ["amount"],
							});
						}
					}),
			)
			.min(1, { error: "At least one bill is required" }),
	})
	.superRefine((data, ctx) => {
		if (data.paymentMethod === "cash" || data.paymentMethod === "mpesa") {
			if (!data.cashEquivalentAccountId) {
				ctx.addIssue({
					code: "custom",
					message: "Account is required",
					path: ["cashEquivalentAccountId"],
				});
			}
		}
		if (
			(data.paymentMethod === "bank" || data.paymentMethod === "cheque") &&
			!data.bankId
		) {
			ctx.addIssue({
				code: "custom",
				message: "Bank is required",
				path: ["bankId"],
			});
		}
	});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
