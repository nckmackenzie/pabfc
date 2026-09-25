import { z } from "zod";

/**
 * A remittance pays KRA the tax withheld across one or more bills — possibly for
 * several vendors at once — so unlike a bill payment it is not vendor-scoped.
 */
export const remittanceFormSchema = z
	.object({
		id: z.string().optional(),
		remittanceNo: z.string().min(1, "Remittance number is required"),
		remittanceDate: z.iso.date({ error: "Invalid date" }),
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
						billId: z.string().min(1, { error: "Bill is required" }),
						invoiceNo: z.string(),
						invoiceDate: z.string(),
						vendorName: z.string(),
						taxPin: z.string().nullish(),
						whtAmount: z.number(),
						/** WHT still owed to KRA on this bill, before this remittance. */
						whtBalance: z.number(),
						amount: z
							.number()
							.positive("Amount must be greater than zero")
							.nullish(),
					})
					.superRefine((data, ctx) => {
						if (!data.selected) return;

						if (!data.amount) {
							ctx.addIssue({
								code: "custom",
								message: "Amount is required",
								path: ["amount"],
							});
							return;
						}

						if (data.amount > data.whtBalance) {
							ctx.addIssue({
								code: "custom",
								message: "Amount exceeds the WHT balance",
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

		if (!data.bills.some((bill) => bill.selected)) {
			ctx.addIssue({
				code: "custom",
				message: "Select at least one bill to remit",
				path: ["bills"],
			});
		}
	});

export type RemittanceFormValues = z.infer<typeof remittanceFormSchema>;
