import { z } from "zod";
import {
	PAYROLL_MONTH_MAX,
	PAYROLL_MONTH_MIN,
	PAYROLL_PERIOD_STATUS,
	PAYROLL_PERIOD_STATUS_VALUES,
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
} from "@/features/payroll/lib/payroll-constants";
import { dateSchema, requiredStringNonLowerSchemaEntry } from "@/lib/schema-rules";
import { toNumber } from "@/lib/helpers";
import { PAYROLL_OTHER_DEDUCTION_TYPES } from "./payroll-slips.schemas";

export const payrollPeriodStatusSchema = z.enum(PAYROLL_PERIOD_STATUS_VALUES);

export const payrollPeriodIdSchema = z.object({
	periodId: z.string().trim().min(1, "Payroll period is required"),
});

export const payrollPeriodCreateFormSchema = z.object({
	id: z.string().optional(),
	periodYear: z
		.number({ error: "Payroll year must be a number" })
		.int("Payroll year must be a whole number")
		.min(
			PAYROLL_PERIOD_YEAR_MIN,
			`Payroll year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}`
		)
		.max(
			PAYROLL_PERIOD_YEAR_MAX,
			`Payroll year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}`
		),
	payDate: dateSchema("Pay date is required"),
	periodMonth: z
		.string()
		.min(1, "Payroll month is required")
		.refine((val) => {
			const numericalValue = toNumber(val);
			return numericalValue >= PAYROLL_MONTH_MIN && numericalValue <= PAYROLL_MONTH_MAX;
		}, `Payroll month must be between ${PAYROLL_MONTH_MIN} and ${PAYROLL_MONTH_MAX}`),
});

export const payrollPeriodCreateSchema = z.object({
	periodMonth: z.coerce.number().int().min(PAYROLL_MONTH_MIN).max(PAYROLL_MONTH_MAX),
	periodYear: z.coerce.number().int().min(PAYROLL_PERIOD_YEAR_MIN).max(PAYROLL_PERIOD_YEAR_MAX),
	payDate: dateSchema("Pay date is required"),
});

export const payrollPeriodTransitionSchema = z
	.object({
		periodId: z.string().trim().min(1, "Payroll period is required"),
		targetStatus: payrollPeriodStatusSchema,
		cancellationReason: z.string().trim().nullable().optional(),
	})
	.superRefine((data, ctx) => {
		if (
			data.targetStatus === PAYROLL_PERIOD_STATUS.CANCELLED &&
			(!data.cancellationReason || data.cancellationReason.trim() === "")
		) {
			ctx.addIssue({
				code: "custom",
				message: "Cancellation reason is required",
				path: ["cancellationReason"],
			});
		}
	});

export const payrollPeriodFiltersSchema = z.object({
	status: payrollPeriodStatusSchema.optional(),
	year: z
		.number()
		.int("Year must be a whole number")
		.min(PAYROLL_PERIOD_YEAR_MIN)
		.max(PAYROLL_PERIOD_YEAR_MAX)
		.optional(),
});

export const payrollPeriodMonthYearSchema = z.object({
	periodMonth: z.coerce
		.number()
		.int("Payroll month must be a whole number")
		.min(PAYROLL_MONTH_MIN)
		.max(PAYROLL_MONTH_MAX),
	periodYear: z.coerce
		.number()
		.int("Payroll year must be a whole number")
		.min(PAYROLL_PERIOD_YEAR_MIN)
		.max(PAYROLL_PERIOD_YEAR_MAX),
});

export const payrollPeriodYearSchema = z.object({
	year: z.coerce
		.number()
		.int("Year must be a whole number")
		.min(PAYROLL_PERIOD_YEAR_MIN)
		.max(PAYROLL_PERIOD_YEAR_MAX),
});

export const bonusEntrySchema = z.object({
	employeeId: requiredStringNonLowerSchemaEntry("Employee is required"),
	amount: z.number().min(1, "Bonus amount must be greater than 0"),
	description: requiredStringNonLowerSchemaEntry("Description is required"),
});

export const bonusFormSchema = z.object({
	periodId: requiredStringNonLowerSchemaEntry("Period is required"),
	employees: z.array(bonusEntrySchema).min(1, "At least one employee is required"),
});

export const payrollPeriodOtherDeductionTypeSchema = z.enum(PAYROLL_OTHER_DEDUCTION_TYPES);

export const payrollPeriodOtherDeductionEntrySchema = z.object({
	employeeId: requiredStringNonLowerSchemaEntry("Employee is required"),
	deductionType: payrollPeriodOtherDeductionTypeSchema,
	amount: z.number().min(1, "Deduction amount must be greater than 0"),
	description: requiredStringNonLowerSchemaEntry("Description is required"),
});

export const payrollPeriodOtherDeductionCreateSchema = z.object({
	payrollPeriodId: requiredStringNonLowerSchemaEntry("Payroll period is required"),
	deductions: z
		.array(payrollPeriodOtherDeductionEntrySchema)
		.min(1, "At least one deduction is required"),
});

export type BonusEntry = z.infer<typeof bonusEntrySchema>;
export type BonusFormValues = z.infer<typeof bonusFormSchema>;
export type DeductionEntry = z.infer<typeof payrollPeriodOtherDeductionEntrySchema>;
export type DeductionFormValues = z.infer<typeof payrollPeriodOtherDeductionCreateSchema>;
