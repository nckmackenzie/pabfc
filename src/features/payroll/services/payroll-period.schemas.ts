import { z } from "zod";
import {
	PAYROLL_MONTH_MAX,
	PAYROLL_MONTH_MIN,
	PAYROLL_PERIOD_STATUS,
	PAYROLL_PERIOD_STATUS_VALUES,
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
} from "@/features/payroll/lib/payroll-constants";
import { dateSchema } from "@/lib/schema-rules";

export const payrollPeriodStatusSchema = z.enum(PAYROLL_PERIOD_STATUS_VALUES);

export const payrollPeriodIdSchema = z.object({
	periodId: z.string().trim().min(1, "Payroll period is required"),
});

export const payrollPeriodCreateFormSchema = z.object({
	periodMonth: z
		.number({ error: "Payroll month must be a number" })
		.int("Payroll month must be a whole number")
		.min(PAYROLL_MONTH_MIN, `Payroll month must be between ${PAYROLL_MONTH_MIN} and ${PAYROLL_MONTH_MAX}`)
		.max(PAYROLL_MONTH_MAX, `Payroll month must be between ${PAYROLL_MONTH_MIN} and ${PAYROLL_MONTH_MAX}`),
	periodYear: z
		.number({ error: "Payroll year must be a number" })
		.int("Payroll year must be a whole number")
		.min(PAYROLL_PERIOD_YEAR_MIN, `Payroll year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}`)
		.max(PAYROLL_PERIOD_YEAR_MAX, `Payroll year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}`),
	payDate: dateSchema("Pay date is required"),
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
