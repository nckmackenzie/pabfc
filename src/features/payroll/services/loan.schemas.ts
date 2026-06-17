import { z } from "zod";
import { LOAN_DEFAULT_INTEREST_RATE, LOAN_STATUS } from "@/features/payroll/lib/payroll-constants";
import { dateSchema } from "@/lib/schema-rules";

const loanStatusValues = Object.values(LOAN_STATUS) as [string & {}, ...(string & {})[]];

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
	.min(2000, "Year must be between 2000 and 2100")
	.max(2100, "Year must be between 2000 and 2100");

const monthField = z
	.number({ error: "Month must be a number" })
	.int("Month must be a whole number")
	.min(1, "Month must be between 1 and 12")
	.max(12, "Month must be between 1 and 12");

const instalmentsField = z
	.number({ error: "Instalments must be a number" })
	.int("Instalments must be a whole number")
	.min(1, "Instalments must be between 1 and 60")
	.max(60, "Instalments must be between 1 and 60");

const annualInterestRateField = z
	.number({ error: "Interest rate must be a number" })
	.refine((value) => Number.isFinite(value) && value >= 0 && value <= 1, {
		message: "Interest rate must be a decimal between 0 and 1, for example 0.1 for 10%",
	});

export const loanStatusSchema = z.enum(["all", ...loanStatusValues]);
export const loanIdSchema = z.string().trim().min(1, "Loan is required");
export const employeeLoanEmployeeIdSchema = z.string().trim().min(1, "Employee is required");

export const applyForLoanSchema = z.object({
	id: z.undefined().optional(),
	employeeId: employeeLoanEmployeeIdSchema,
	principalAmount: requiredPositiveAmountField("Principal amount"),
	requestedInstalments: instalmentsField,
	purpose: optionalTextField(5000),
	annualInterestRate: annualInterestRateField.default(LOAN_DEFAULT_INTEREST_RATE),
});

export const approveLoanSchema = z.object({
	loanId: loanIdSchema,
	payload: z.object({
		approvedAmount: requiredPositiveAmountField("Approved amount"),
		approvedInstalments: instalmentsField,
		disbursementAccountId: z
			.number({ error: "Disbursement account is required" })
			.int("Disbursement account is invalid")
			.positive("Disbursement account is invalid"),
		repaymentStartMonth: monthField,
		repaymentStartYear: yearField,
		notes: optionalTextField(5000),
	}),
});

export const rejectLoanSchema = z.object({
	loanId: loanIdSchema,
	rejectionReason: z
		.string()
		.trim()
		.min(1, "Rejection reason is required")
		.max(5000, "Rejection reason must be 5000 characters or less"),
});

export const pauseLoanSchema = z.object({
	loanId: loanIdSchema,
	notes: optionalTextField(5000),
});

export const resumeLoanSchema = z.object({
	loanId: loanIdSchema,
	repaymentStartMonth: monthField,
	repaymentStartYear: yearField,
	notes: optionalTextField(5000),
});

export const settleEarlySchema = z.object({
	loanId: loanIdSchema,
	settlementAmount: requiredPositiveAmountField("Settlement amount"),
	disbursementAccountId: z
		.number({ error: "Receiving account is required" })
		.int("Receiving account is invalid")
		.positive("Receiving account is invalid"),
	notes: optionalTextField(5000),
});

export const payrollLoanRepaymentSchema = z.object({
	loanId: loanIdSchema,
	periodMonth: monthField,
	periodYear: yearField,
	payrollSlipId: z.string().trim().min(1, "Payroll slip is required"),
});

export const loanByIdSchema = z.object({
	loanId: loanIdSchema,
});

export const loansByEmployeeSchema = z.object({
	employeeId: employeeLoanEmployeeIdSchema,
	statusFilter: loanStatusSchema.optional(),
});

export const activeLoansForEmployeeSchema = z.object({
	employeeId: employeeLoanEmployeeIdSchema,
});

export const totalMonthlyLoanObligationsSchema = z.object({
	employeeId: employeeLoanEmployeeIdSchema,
	periodMonth: monthField,
	periodYear: yearField,
});

export const allActiveLoansFilterSchema = z.object({
	q: z.string().optional().catch(""),
	departmentId: z.coerce.number().int().positive().optional().catch(undefined),
	employeeId: z.string().trim().optional().catch(undefined),
	status: loanStatusSchema.optional().catch(undefined),
});

export const loanCreateFormSchema = z.object({
	id: z.undefined().optional(),
	employeeId: employeeLoanEmployeeIdSchema,
	principalAmount: requiredPositiveAmountField("Principal amount"),
	requestedInstalments: instalmentsField,
	purpose: optionalTextField(5000),
	annualInterestRate: annualInterestRateField,
});

export const loanApproveFormSchema = z.object({
	id: z.string(),
	approvedAmount: requiredPositiveAmountField("Approved amount"),
	approvedInstalments: instalmentsField,
	disbursementAccountId: z.string().trim().min(1, "Disbursement account is required"),
	repaymentStartMonth: monthField,
	repaymentStartYear: yearField,
	notes: optionalTextField(5000),
});

export const loanRejectFormSchema = z.object({
	id: z.string(),
	loanId: loanIdSchema,
	rejectionReason: z
		.string()
		.trim()
		.min(1, "Rejection reason is required")
		.max(5000, "Rejection reason must be 5000 characters or less"),
});

export const loanPauseFormSchema = z.object({
	id: z.string(),
	loanId: loanIdSchema,
	notes: optionalTextField(5000),
});

export const loanResumeFormSchema = z.object({
	id: z.string(),
	loanId: loanIdSchema,
	repaymentStartMonth: monthField,
	repaymentStartYear: yearField,
	notes: optionalTextField(5000),
});

export const loanSettlementFormSchema = z.object({
	id: z.string(),
	loanId: loanIdSchema,
	settlementAmount: requiredPositiveAmountField("Settlement amount"),
	disbursementAccountId: z.string().trim().min(1, "Receiving account is required"),
	notes: optionalTextField(5000),
});

export const loanDetailParamsSchema = z.object({
	loanId: loanIdSchema,
});

export const loanApplicationPrefillSearchSchema = z.object({
	employeeId: z.string().optional().catch(""),
});

export const loanRepaymentHistoryFilterSchema = z.object({
	fromDate: dateSchema("Invalid start date").optional(),
	toDate: dateSchema("Invalid end date").optional(),
});

export type LoanCreateFormInput = z.infer<typeof loanCreateFormSchema>;
export type LoanApproveFormInput = z.infer<typeof loanApproveFormSchema>;
export type LoanRejectFormInput = z.infer<typeof loanRejectFormSchema>;
export type LoanPauseFormInput = z.infer<typeof loanPauseFormSchema>;
export type LoanResumeFormInput = z.infer<typeof loanResumeFormSchema>;
export type LoanSettlementFormInput = z.infer<typeof loanSettlementFormSchema>;
