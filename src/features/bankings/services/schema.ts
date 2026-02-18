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

export const clearBankingsValidateSearch = z
	.object({
		bankId: z.string().optional().catch(""),
		from: z.iso.date().optional().catch(""),
		to: z.iso.date().optional().catch(""),
	})
	.superRefine(({ from, to }, ctx) => {
		if (
			from &&
			to &&
			new Date(from).setHours(23, 59, 59, 999) >
				new Date(to).setHours(23, 59, 59, 999)
		) {
			ctx.addIssue({
				code: "custom",
				message: "From date must be before to date",
				path: ["from"],
			});
		}
	});

export const clearBankingsFilterFormSchema = z.object({
	bankId: z.string().min(1, "Bank is required"),
	from: z.iso.date({
		error: (iss) =>
			iss.input === undefined
				? "From date is required"
				: "From date is invalid",
	}),
	to: z.iso.date({
		error: (iss) =>
			iss.input === undefined ? "To date is required" : "To date is invalid",
	}),
});

export const bulkBankClearingsFormSchema = z.object({
	bankId: z.string().min(1, "Bank is required"),
	bankings: z.array(
		z
			.object({
				selected: z.boolean(),
				transactionDate: z.string(),
				amount: z.number(),
				reference: z.string(),
				direction: z.enum(["credit", "debit"]),
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
					)
					.nullish(),
			})
			.superRefine(({ selected, clearedAt, transactionDate }, ctx) => {
				if (selected && !clearedAt) {
					ctx.addIssue({
						code: "custom",
						message: "Cleared at is required",
						path: ["clearedAt"],
					});
				}
				if (clearedAt) {
					if (
						new Date(clearedAt).setHours(23, 59, 59, 999) <
						new Date(transactionDate).setHours(23, 59, 59, 999)
					) {
						ctx.addIssue({
							code: "custom",
							message: "Cannot be earlier.",
							path: ["clearedAt"],
						});
					}
				}
			}),
	),
});

export const bankReconciliationValidateSearch = z.object({
	bankId: z.string().optional().catch(""),
	from: z.iso.date().optional().catch(""),
	to: z.iso.date().optional().catch(""),
	bankBalance: z.number().optional().catch(0),
});

export const bankReconciliationFormSchema = z.object({
	bankId: z.string().min(1, "Bank is required"),
	bankBalance: z.number().positive("Bank balance is required"),
	dateRange: z
		.object({
			from: z.date(),
			to: z.date(),
		})
		.refine((data) => !!data.from, "From date is required")
		.refine((data) => !!data.to, "To date is required"),
});

export type BankPostingSchema = z.infer<typeof bankPostingSchema>;
export type BankPostingClearenceFormSchema = z.infer<
	typeof bankPostingClearenceFormSchema
>;
export type ClearBankingsValidateSearch = z.infer<
	typeof clearBankingsValidateSearch
>;
export type BulkBankClearingsFormSchema = z.infer<
	typeof bulkBankClearingsFormSchema
>;
