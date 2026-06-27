import { z } from "zod";
import {
	SALARY_ADVANCE_MAX_RECOVERY_MONTHS,
	SALARY_ADVANCE_STATUS,
} from "@/features/payroll/lib/payroll-constants";
import {
	monthFieldSchemaEntry,
	nullableTrimmedString,
	requiredNumberSchemaEntry,
	yearFieldSchemaEntry,
} from "@/lib/schema-rules";

type SalaryAdvanceStatusValue = (typeof SALARY_ADVANCE_STATUS)[keyof typeof SALARY_ADVANCE_STATUS];

const salaryAdvanceStatusValues = Object.values(SALARY_ADVANCE_STATUS) as [
	SalaryAdvanceStatusValue,
	...SalaryAdvanceStatusValue[],
];

const recoveryMonthsField = z
	.number({ error: "Recovery months must be a number" })
	.int("Recovery months must be a whole number")
	.min(1, `Recovery months must be between 1 and ${SALARY_ADVANCE_MAX_RECOVERY_MONTHS}`)
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
	requestedAmount: requiredNumberSchemaEntry(),
	requestedRecoveryMonths: recoveryMonthsField,
	reason: nullableTrimmedString,
});

export const approveSalaryAdvanceSchema = z.object({
	advanceId: salaryAdvanceIdSchema,
	payload: z.object({
		approvedAmount: requiredNumberSchemaEntry(),
		approvedRecoveryMonths: recoveryMonthsField,
		disbursementAccountId: z
			.number({ error: "Disbursement account is required" })
			.int("Disbursement account is invalid")
			.positive("Disbursement account is invalid"),
		recoveryStartMonth: monthFieldSchemaEntry,
		recoveryStartYear: yearFieldSchemaEntry(),
		notes: nullableTrimmedString,
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
	periodMonth: monthFieldSchemaEntry,
	periodYear: yearFieldSchemaEntry(),
});

export const payrollAdvanceRecoverySchema = z.object({
	advanceId: salaryAdvanceIdSchema,
	periodMonth: monthFieldSchemaEntry,
	periodYear: yearFieldSchemaEntry(),
	payrollSlipId: z.string().trim().min(1, "Payroll slip is required"),
});

export const allActiveSalaryAdvancesFilterSchema = z.object({
	departmentId: z.coerce.number().int().positive().optional().catch(undefined),
	employeeId: z.string().trim().optional().catch(undefined),
});

export const salaryAdvanceCreateFormSchema = z.object({
	id: z.undefined().optional(),
	employeeId: salaryAdvanceEmployeeIdSchema,
	requestedAmount: requiredNumberSchemaEntry(),
	requestedRecoveryMonths: recoveryMonthsField,
	reason: nullableTrimmedString,
});

export const salaryAdvanceApproveFormSchema = z.object({
	id: z.string(),
	approvedAmount: requiredNumberSchemaEntry(),
	approvedRecoveryMonths: recoveryMonthsField,
	disbursementAccountId: z.string().trim().min(1, "Disbursement account is required"),
	recoveryStartMonth: monthFieldSchemaEntry,
	recoveryStartYear: yearFieldSchemaEntry(),
	notes: nullableTrimmedString,
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
