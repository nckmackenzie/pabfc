import { z } from "zod";
import {
	PAYROLL_MONTH_MAX,
	PAYROLL_MONTH_MIN,
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
	SALARY_ADVANCE_MAX_RECOVERY_MONTHS,
	SALARY_ADVANCE_STATUS,
} from "@/features/payroll/lib/payroll-constants";

type SalaryAdvanceStatusValue =
	(typeof SALARY_ADVANCE_STATUS)[keyof typeof SALARY_ADVANCE_STATUS];

const salaryAdvanceStatusValues = Object.values(SALARY_ADVANCE_STATUS) as [
	SalaryAdvanceStatusValue,
	...SalaryAdvanceStatusValue[],
];

const optionalTextField = (max: number) =>
	z
		.string()
		.trim()
		.max(max, { message: `Must be ${max} characters or less` })
		.nullable();

const requiredPositiveAmountField = (label: string) =>
	z
		.number({ error: `${label} must be a number` })
		.refine((value) => Number.isFinite(value) && value > 0, {
			message: `${label} must be greater than zero`,
		});

const yearField = z
	.number({ error: "Year must be a number" })
	.int("Year must be a whole number")
	.min(
		PAYROLL_PERIOD_YEAR_MIN,
		`Year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}`
	)
	.max(
		PAYROLL_PERIOD_YEAR_MAX,
		`Year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}`
	);

const monthField = z
	.number({ error: "Month must be a number" })
	.int("Month must be a whole number")
	.min(PAYROLL_MONTH_MIN, `Month must be between ${PAYROLL_MONTH_MIN} and ${PAYROLL_MONTH_MAX}`)
	.max(PAYROLL_MONTH_MAX, `Month must be between ${PAYROLL_MONTH_MIN} and ${PAYROLL_MONTH_MAX}`);

const recoveryMonthsField = z
	.number({ error: "Recovery months must be a number" })
	.int("Recovery months must be a whole number")
	.min(
		1,
		`Recovery months must be between 1 and ${SALARY_ADVANCE_MAX_RECOVERY_MONTHS}`
	)
	.max(
		SALARY_ADVANCE_MAX_RECOVERY_MONTHS,
		`Recovery months must be between 1 and ${SALARY_ADVANCE_MAX_RECOVERY_MONTHS}`
	);

export const salaryAdvanceStatusSchema = z.enum(["all", ...salaryAdvanceStatusValues]);
export const salaryAdvanceIdSchema = z.string().trim().min(1, "Salary advance is required");
export const salaryAdvanceEmployeeIdSchema = z.string().trim().min(1, "Employee is required");

export const applyForSalaryAdvanceSchema = z.object({
	id: z.undefined().optional(),
	employeeId: salaryAdvanceEmployeeIdSchema,
	requestedAmount: requiredPositiveAmountField("Requested amount"),
	requestedRecoveryMonths: recoveryMonthsField,
	reason: optionalTextField(5000),
});

export const approveSalaryAdvanceSchema = z.object({
	advanceId: salaryAdvanceIdSchema,
	payload: z.object({
		approvedAmount: requiredPositiveAmountField("Approved amount"),
		approvedRecoveryMonths: recoveryMonthsField,
		disbursementAccountId: z
			.number({ error: "Disbursement account is required" })
			.int("Disbursement account is invalid")
			.positive("Disbursement account is invalid"),
		recoveryStartMonth: monthField,
		recoveryStartYear: yearField,
		notes: optionalTextField(5000),
	}),
});

export const rejectSalaryAdvanceSchema = z.object({
	advanceId: salaryAdvanceIdSchema,
	rejectionReason: z
		.string()
		.trim()
		.min(1, "Rejection reason is required")
		.max(5000, "Rejection reason must be 5000 characters or less"),
});

export const cancelSalaryAdvanceSchema = z.object({
	advanceId: salaryAdvanceIdSchema,
	cancellationReason: z
		.string()
		.trim()
		.min(1, "Cancellation reason is required")
		.max(5000, "Cancellation reason must be 5000 characters or less"),
});

export const salaryAdvanceByIdSchema = z.object({
	advanceId: salaryAdvanceIdSchema,
});

export const salaryAdvancesByEmployeeSchema = z.object({
	employeeId: salaryAdvanceEmployeeIdSchema,
	statusFilter: salaryAdvanceStatusSchema.optional(),
});

export const activeSalaryAdvancesForEmployeeSchema = z.object({
	employeeId: salaryAdvanceEmployeeIdSchema,
});

export const totalMonthlyAdvanceRecoveriesSchema = z.object({
	employeeId: salaryAdvanceEmployeeIdSchema,
	periodMonth: monthField,
	periodYear: yearField,
});

export const payrollAdvanceRecoverySchema = z.object({
	advanceId: salaryAdvanceIdSchema,
	periodMonth: monthField,
	periodYear: yearField,
	payrollSlipId: z.string().trim().min(1, "Payroll slip is required"),
});

export const allActiveSalaryAdvancesFilterSchema = z.object({
	departmentId: z.coerce.number().int().positive().optional().catch(undefined),
	employeeId: z.string().trim().optional().catch(undefined),
});

export const salaryAdvanceCreateFormSchema = z.object({
	id: z.undefined().optional(),
	employeeId: salaryAdvanceEmployeeIdSchema,
	requestedAmount: requiredPositiveAmountField("Requested amount"),
	requestedRecoveryMonths: recoveryMonthsField,
	reason: optionalTextField(5000),
});

export const salaryAdvanceApproveFormSchema = z.object({
	id: z.string(),
	approvedAmount: requiredPositiveAmountField("Approved amount"),
	approvedRecoveryMonths: recoveryMonthsField,
	disbursementAccountId: z.string().trim().min(1, "Disbursement account is required"),
	recoveryStartMonth: monthField,
	recoveryStartYear: yearField,
	notes: optionalTextField(5000),
});

export const salaryAdvanceRejectFormSchema = z.object({
	id: z.string(),
	advanceId: salaryAdvanceIdSchema,
	rejectionReason: z
		.string()
		.trim()
		.min(1, "Rejection reason is required")
		.max(5000, "Rejection reason must be 5000 characters or less"),
});

export const salaryAdvanceCancelFormSchema = z.object({
	id: z.string(),
	advanceId: salaryAdvanceIdSchema,
	cancellationReason: z
		.string()
		.trim()
		.min(1, "Cancellation reason is required")
		.max(5000, "Cancellation reason must be 5000 characters or less"),
});

export const salaryAdvanceDetailParamsSchema = z.object({
	advanceId: salaryAdvanceIdSchema,
});

export const salaryAdvanceApplicationPrefillSearchSchema = z.object({
	employeeId: z.string().optional().catch(""),
});

export type SalaryAdvanceCreateFormInput = z.infer<typeof salaryAdvanceCreateFormSchema>;
export type SalaryAdvanceApproveFormInput = z.infer<typeof salaryAdvanceApproveFormSchema>;
export type SalaryAdvanceRejectFormInput = z.infer<typeof salaryAdvanceRejectFormSchema>;
export type SalaryAdvanceCancelFormInput = z.infer<typeof salaryAdvanceCancelFormSchema>;
