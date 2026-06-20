import { z } from "zod";
import { PAYROLL_REMITTANCE_ITEM_TYPES } from "@/features/payroll/lib/payroll-constants";
import { dateSchema } from "@/lib/schema-rules";

export const payrollJournalEntryIdSchema = z.object({
	journalEntryId: z.coerce.number().int().positive("Journal entry is required"),
});

export const payrollJournalPeriodIdSchema = z.object({
	periodId: z.string().trim().min(1, "Payroll period is required"),
});

export const payrollJournalAccountIdSchema = z.coerce
	.number()
	.int("Select an account")
	.positive("Select an account");

const optionalNotesSchema = z.string().trim().max(5000).nullable().optional();

export const salaryDisbursementJournalSchema = z.object({
	periodId: z.string().trim().min(1, "Payroll period is required"),
	disbursementDate: dateSchema("Disbursement date is required")
		.optional()
		.catch(undefined),
	disbursementAccountId: payrollJournalAccountIdSchema,
	notes: optionalNotesSchema,
});

export const payrollRemittanceItemTypeSchema = z.enum(PAYROLL_REMITTANCE_ITEM_TYPES);

export const statutoryRemittanceItemSchema = z.object({
	type: payrollRemittanceItemTypeSchema,
	amountRemitted: z.coerce.number({ error: "Amount remitted must be a number" }).positive({
		message: "Amount remitted must be greater than zero",
	}),
});

export const statutoryRemittanceJournalSchema = z.object({
	periodId: z.string().trim().min(1, "Payroll period is required"),
	remittanceDate: dateSchema("Remittance date is required").optional().catch(undefined),
	remittanceAccountId: payrollJournalAccountIdSchema,
	remittedItems: z
		.array(statutoryRemittanceItemSchema)
		.min(1, "At least one remitted item is required"),
	notes: optionalNotesSchema,
});

export type PayrollRemittanceItemType = z.infer<typeof payrollRemittanceItemTypeSchema>;
