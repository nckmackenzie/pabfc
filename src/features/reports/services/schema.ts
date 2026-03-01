import { z } from "zod";
import {
	EXPENSES_REPORT_TYPE,
	RECEIPTS_REPORT_TYPE,
} from "@/features/reports/lib/constants";
import { dateRangeRequiredSchema, dateRangeSchema } from "@/lib/schema-rules";

export const receiptValidateSchema = dateRangeSchema.safeExtend({
	reportType: z.enum(RECEIPTS_REPORT_TYPE.map((type) => type.value)).optional(),
	memberId: z.string().optional(),
});

export const receiptReportFormSchema = dateRangeRequiredSchema
	.safeExtend({
		reportType: z.enum(
			RECEIPTS_REPORT_TYPE.map((type) => type.value),
			{
				error: (iss) =>
					!iss.input ? "Select report type" : "Invalid report type",
			},
		),
		memberId: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.reportType === "by-member" && !data.memberId) {
			ctx.addIssue({
				code: "custom",
				message: "Select member",
				path: ["memberId"],
			});
		}
	});

export type ReceiptValidateSchema = z.infer<typeof receiptReportFormSchema>;

export const expenseValidateSchema = dateRangeSchema.safeExtend({
	reportType: z.enum(EXPENSES_REPORT_TYPE.map((type) => type.value)).optional(),
	accountId: z.string().optional(),
	payeeId: z.string().optional(),
});

export const expenseReportFormSchema = dateRangeRequiredSchema
	.safeExtend({
		reportType: z.enum(
			EXPENSES_REPORT_TYPE.map((type) => type.value),
			{
				error: (iss) =>
					!iss.input ? "Select report type" : "Invalid report type",
			},
		),
		accountId: z.string().optional(),
		payeeId: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.reportType === "by-expense-account" && !data.accountId) {
			ctx.addIssue({
				code: "custom",
				message: "Select expense account",
				path: ["accountId"],
			});
		}

		if (data.reportType === "by-payee" && !data.payeeId) {
			ctx.addIssue({
				code: "custom",
				message: "Select payee",
				path: ["payeeId"],
			});
		}
	});

export type ExpenseValidateSchema = z.infer<typeof expenseReportFormSchema>;
