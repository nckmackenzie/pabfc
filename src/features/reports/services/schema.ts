import { z } from "zod";
import {
	ATTENDANCE_REPORT_TYPE,
	BANKING_REPORT_STATUS,
	BANKING_REPORT_TYPE,
	EXPENSES_REPORT_TYPE,
	INVOICES_REPORT_TYPE,
	MEMBERS_REPORT_TYPE,
	MEMBERS_STATUS_REPORT_FILTER,
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

export const invoiceValidateSchema = dateRangeSchema.safeExtend({
	reportType: z.enum(INVOICES_REPORT_TYPE.map((type) => type.value)).optional(),
	vendorId: z.string().optional(),
});

export const invoiceReportFormSchema = dateRangeSchema
	.safeExtend({
		reportType: z.enum(
			INVOICES_REPORT_TYPE.map((type) => type.value),
			{
				error: (iss) =>
					!iss.input ? "Select report type" : "Invalid report type",
			},
		),
		vendorId: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		const requiresDateRange =
			data.reportType === "vendor-spend-summary" || data.reportType === "all";

		if (requiresDateRange) {
			if (!data.dateRange?.from || !data.dateRange?.to) {
				ctx.addIssue({
					code: "custom",
					message: "Select date range",
					path: ["dateRange"],
				});
			}

			if (!data.vendorId) {
				ctx.addIssue({
					code: "custom",
					message: "Select vendor",
					path: ["vendorId"],
				});
			}
		}
	});

export type ExpenseValidateSchema = z.infer<typeof expenseReportFormSchema>;
export type InvoiceReportFormSchema = z.infer<typeof invoiceReportFormSchema>;

export const bankingValidateSchema = dateRangeSchema.safeExtend({
	reportType: z.enum(BANKING_REPORT_TYPE.map((type) => type.value)).optional(),
	bankId: z.string().optional(),
	status: z.enum(BANKING_REPORT_STATUS.map((type) => type.value)).optional(),
});

export const bankingReportFormSchema = dateRangeRequiredSchema
	.safeExtend({
		reportType: z.enum(
			BANKING_REPORT_TYPE.map((type) => type.value),
			{
				error: (iss) =>
					!iss.input ? "Select report type" : "Invalid report type",
			},
		),
		bankId: z
			.string({ error: (iss) => (!iss.input ? "Select bank" : "Invalid bank") })
			.min(1, "Select bank"),
		status: z.enum(BANKING_REPORT_STATUS.map((type) => type.value)).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.reportType === "by-status" && !data.status) {
			ctx.addIssue({
				code: "custom",
				message: "Select status",
				path: ["status"],
			});
		}
	});

export const paymentsValidateSchema = dateRangeSchema.safeExtend({
	vendorId: z.string().optional(),
});

export const paymentsReportFormSchema = dateRangeRequiredSchema.safeExtend({
	vendorId: z.string().min(1, "Select vendor"),
});

export const trialBalanceValidateSearchSchema = z.object({
	asOfDate: z.iso.date().optional(),
});

export const trialBalanceReportFormSchema = z.object({
	asOfDate: z.iso
		.date({
			error: (iss) => (!iss.input ? "Select as of date" : "Invalid date"),
		})
		.refine(
			(date) =>
				new Date(date).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0),
			{
				error: "As of date cannot be in the future",
			},
		),
});

export const membersReportValidateSearchSchema = z.object({
	asOfDate: z.iso.date().optional(),
	reportType: z.enum(MEMBERS_REPORT_TYPE.map((type) => type.value)).optional(),
	status: z
		.enum(MEMBERS_STATUS_REPORT_FILTER.map((type) => type.value))
		.optional(),
});

export const membersReportFormSchema = z
	.object({
		asOfDate: z.iso
			.date({
				error: (iss) => (!iss.input ? "Select as of date" : "Invalid date"),
			})
			.refine(
				(date) =>
					new Date(date).setHours(0, 0, 0, 0) <=
					new Date().setHours(0, 0, 0, 0),
				{
					error: "As of date cannot be in the future",
				},
			),
		reportType: z.enum(
			MEMBERS_REPORT_TYPE.map((type) => type.value),
			{
				error: (iss) =>
					!iss.input ? "Select report type" : "Invalid report type",
			},
		),
		status: z
			.enum(MEMBERS_STATUS_REPORT_FILTER.map((type) => type.value))
			.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.reportType === "by-status" && !data.status) {
			ctx.addIssue({
				code: "custom",
				message: "Select status",
				path: ["status"],
			});
		}
	});

export const attendanceReportValidateSearchSchema = z.object({
	asOfDate: z.iso.date().optional(),
	reportType: z
		.enum(ATTENDANCE_REPORT_TYPE.map((type) => type.value))
		.optional(),
	memberId: z.string().optional(),
});

export const attendanceReportFormSchema = z
	.object({
		asOfDate: z.iso
			.date({
				error: (iss) => (!iss.input ? "Select as of date" : "Invalid date"),
			})
			.refine(
				(date) =>
					new Date(date).setHours(0, 0, 0, 0) <=
					new Date().setHours(0, 0, 0, 0),
				{
					error: "As of date cannot be in the future",
				},
			),
		reportType: z.enum(
			ATTENDANCE_REPORT_TYPE.map((type) => type.value),
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

export type BankingValidateSchema = z.infer<typeof bankingReportFormSchema>;
export type PaymentsReportFormSchema = z.infer<typeof paymentsReportFormSchema>;
export type MembersReportFormSchema = z.infer<typeof membersReportFormSchema>;
export type AttendanceReportFormSchema = z.infer<
	typeof attendanceReportFormSchema
>;
