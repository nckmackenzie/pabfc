import { z } from "zod";
import {
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
	PAYROLL_SLIP_STATUSES,
} from "@/features/payroll/lib/payroll-constants";

const positiveAmountField = (label: string) =>
	z
		.number({ error: `${label} must be a number` })
		.refine((value) => Number.isFinite(value) && value > 0, {
			message: `${label} must be greater than zero`,
		});

const optionalTextField = (max: number) =>
	z
		.string()
		.trim()
		.max(max, { message: `Must be ${max} characters or less` })
		.nullable()
		.optional();

export const payrollSlipIdSchema = z.object({
	slipId: z.string().trim().min(1, "Payroll slip is required"),
});

export const payrollSlipStatusSchema = z.enum(PAYROLL_SLIP_STATUSES);

export const payrollSlipPeriodSearchSchema = z.object({
	payrollPeriodId: z.string().trim().min(1, "Payroll period is required"),
	departmentId: z.number().int().positive().optional(),
	status: payrollSlipStatusSchema.optional(),
});

export const payrollSlipForEmployeeSchema = z.object({
	employeeId: z.string().trim().min(1, "Employee is required"),
	payrollPeriodId: z.string().trim().min(1, "Payroll period is required"),
});

export const employeePayrollHistorySchema = z
	.object({
		employeeId: z.string().trim().min(1, "Employee is required"),
		fromYear: z.number().int().min(PAYROLL_PERIOD_YEAR_MIN).max(PAYROLL_PERIOD_YEAR_MAX).optional(),
		toYear: z.number().int().min(PAYROLL_PERIOD_YEAR_MIN).max(PAYROLL_PERIOD_YEAR_MAX).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.fromYear !== undefined && data.toYear !== undefined && data.fromYear > data.toYear) {
			ctx.addIssue({
				code: "custom",
				message: "From year cannot be after to year",
				path: ["fromYear"],
			});
		}
	});

export const payrollDepartmentSummarySchema = z.object({
	payrollPeriodId: z.string().trim().min(1, "Payroll period is required"),
});

export const payrollSlipCancelSchema = z.object({
	slipId: z.string().trim().min(1, "Payroll slip is required"),
	reason: z.string().trim().min(1, "Cancellation reason is required").max(5000),
});

export const payrollSlipBonusSchema = z.object({
	slipId: z.string().trim().min(1, "Payroll slip is required"),
	bonusAmount: positiveAmountField("Bonus amount"),
	description: z
		.string()
		.trim()
		.min(1, "Description is required")
		.max(255, "Description must be 255 characters or less"),
	notes: optionalTextField(5000),
});

export const PAYROLL_OTHER_DEDUCTION_TYPES = [
	"sacco",
	"union_dues",
	"court_order",
	"insurance",
	"welfare",
	"other",
] as const;

export const payrollPeriodAdjustmentOptionsSchema = z.object({
	payrollPeriodId: z.string().trim().min(1, "Payroll period is required"),
});
