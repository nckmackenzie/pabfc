import { z } from "zod";
import { WHT_CATEGORIES } from "@/drizzle/schema";

// invoiceNo/vendorName are deliberately not part of this schema: they are
// display-only and looked up from the correctable-bills list by `billId`
// wherever the UI needs them (the bill combobox's own label, the duplicate
// warning banner), rather than duplicated into form/submission state.
export const correctionLineSchema = z.object({
	billId: z.string().min(1, { error: "Bill is required" }),
	whtCategory: z.enum(WHT_CATEGORIES, { error: "Category is required" }),
	whtRate: z.number().positive("Rate must be greater than zero"),
	amount: z.number().positive("Amount must be greater than zero"),
});

/**
 * `already_remitted` covers a catch-up already paid to KRA out of pocket —
 * pure historical bookkeeping, no WHT Payable involved. `pending` is a missed
 * WHT still owed, and feeds the existing WHT Payable + remittance workflow.
 * There is no edit flow (mistakes are fixed by delete + recreate), so unlike
 * the WHT remittance form's schema, this one never carries an `id`.
 */
export const correctionFormSchema = z
	.object({
		correctionNo: z.string().min(1, "Correction number is required"),
		correctionDate: z.iso.date({ error: "Invalid date" }),
		treatmentAccountId: z
			.string()
			.min(1, { error: "Treatment account is required" }),
		remittanceStatus: z.enum(["already_remitted", "pending"], {
			error: "Remittance status is required",
		}),
		remittanceDate: z.iso.date().nullish(),
		paymentMethod: z.enum(["cash", "mpesa", "bank", "cheque"]).nullish(),
		bankId: z.string().nullish(),
		cashEquivalentAccountId: z.string().nullish(),
		memo: z.string().nullish(),
		lines: z
			.array(correctionLineSchema)
			.min(1, { error: "At least one line is required" }),
	})
	.superRefine((data, ctx) => {
		const billIds = data.lines.map((line) => line.billId);
		if (new Set(billIds).size !== billIds.length) {
			ctx.addIssue({
				code: "custom",
				message: "The same bill cannot be listed twice in one correction",
				path: ["lines"],
			});
		}

		if (data.remittanceStatus !== "already_remitted") return;

		if (!data.remittanceDate) {
			ctx.addIssue({
				code: "custom",
				message: "Remittance date is required",
				path: ["remittanceDate"],
			});
		}

		if (!data.paymentMethod) {
			ctx.addIssue({
				code: "custom",
				message: "Payment method is required",
				path: ["paymentMethod"],
			});
			return;
		}

		if (
			(data.paymentMethod === "cash" || data.paymentMethod === "mpesa") &&
			!data.cashEquivalentAccountId
		) {
			ctx.addIssue({
				code: "custom",
				message: "Account is required",
				path: ["cashEquivalentAccountId"],
			});
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

export type CorrectionFormValues = z.infer<typeof correctionFormSchema>;
export type CorrectionLineValues = z.infer<typeof correctionLineSchema>;
