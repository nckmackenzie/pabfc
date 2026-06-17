import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
	departments,
	employeeLoans,
	employees,
	ledgerAccounts,
	loanRepayments,
	payrollAccountMappings,
	users,
} from "@/drizzle/schema";
import { computeLoanSchedule, computeSingleInstalment } from "@/features/payroll/lib/loan-helpers";
import { LOAN_DEFAULT_INTEREST_RATE, LOAN_STATUS } from "@/features/payroll/lib/payroll-constants";
import {
	getCurrentPeriodParts,
	getPeriodIndex,
	roundPayrollAmount,
	toPayrollBig,
	toPayrollDecimalString,
} from "@/features/payroll/lib/helpers";
import {
	activeLoansForEmployeeSchema,
	allActiveLoansFilterSchema,
	applyForLoanSchema,
	approveLoanSchema,
	loanByIdSchema,
	loansByEmployeeSchema,
	pauseLoanSchema,
	payrollLoanRepaymentSchema,
	rejectLoanSchema,
	resumeLoanSchema,
	settleEarlySchema,
	totalMonthlyLoanObligationsSchema,
} from "@/features/payroll/services/loan.schemas";
import { normalizeText } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";

type LoanRecord = typeof employeeLoans.$inferSelect;
type LoanRepaymentRecord = typeof loanRepayments.$inferSelect;
type ApplyForLoanPayload = z.infer<typeof applyForLoanSchema>;
type AllActiveLoansFilters = z.infer<typeof allActiveLoansFilterSchema>;
type ApproveLoanPayload = z.infer<typeof approveLoanSchema>["payload"];
type LoanNumericFields = {
	annualInterestRate: number;
	approvedAmount: number | null;
	monthlyInstalment: number | null;
	outstandingBalance: number | null;
	principalAmount: number;
	totalInterestPaid: number;
	totalPrincipalPaid: number;
	totalPaid: number;
};
type LoanRepaymentNumericFields = {
	balanceAfter: number;
	balanceBefore: number;
	interestComponent: number;
	principalComponent: number;
	totalRepayment: number;
};

type LoanView = Omit<LoanRecord, keyof LoanNumericFields> &
	LoanNumericFields & {
		remainingInstalments: number;
	};

type LoanRepaymentView = Omit<LoanRepaymentRecord, keyof LoanRepaymentNumericFields> &
	LoanRepaymentNumericFields;

type LoanApplicationResponse = {
	loan: LoanView;
	schedulePreview: ReturnType<typeof computeLoanSchedule>;
};

type LoanApprovalResponse = {
	loan: LoanView;
	schedule: ReturnType<typeof computeLoanSchedule>;
};

type LoanSettlementResponse = {
	loan: LoanView;
	repayment: LoanRepaymentView;
};

type LoanListItem = LoanView & {
	departmentId: number | null;
	departmentName: string | null;
	employeeNo: string;
	fullName: string;
	jobTitle: string | null;
};

type LoanDetailView = LoanListItem & {
	approvedByName: string | null;
	pausedByName: string | null;
	rejectedByName: string | null;
	resumedByName: string | null;
	repayments: LoanRepaymentView[];
	schedule: ReturnType<typeof computeLoanSchedule>;
};

type LoanLedgerView = {
	closingOutstandingBalance: number;
	entries: Array<{
		balanceAfter: number;
		balanceBefore: number;
		date: string;
		interest: number;
		isEarlySettlement: boolean;
		principal: number;
		total: number;
	}>;
	loanId: string;
	openingBalance: number;
};

type LoanFormOptions = {
	departments: Array<{
		id: number;
		name: string;
	}>;
	disbursementAccounts: Array<{
		code: string | null;
		id: number;
		name: string;
	}>;
	employees: Array<{
		departmentId: number | null;
		employeeNo: string;
		fullName: string;
		id: string;
	}>;
};

type TotalMonthlyLoanObligationResponse = {
	employeeId: string;
	items: Array<{
		annualInterestRate: number;
		loanId: string;
		monthlyInstalment: number;
		outstandingBalance: number;
	}>;
	totalMonthlyInstalment: number;
};

function getTodayDateString() {
	return new Date().toISOString().slice(0, 10);
}

function parseLoanRecord(record: LoanRecord): LoanView {
	const approvedInstalments = record.approvedInstalments ?? record.requestedInstalments;
	const totalPrincipalPaid = roundPayrollAmount(record.totalPrincipalPaid);
	const totalInterestPaid = roundPayrollAmount(record.totalInterestPaid);
	return {
		...record,
		principalAmount: roundPayrollAmount(record.principalAmount),
		annualInterestRate: roundPayrollAmount(record.annualInterestRate),
		approvedAmount:
			record.approvedAmount === null ? null : roundPayrollAmount(record.approvedAmount),
		monthlyInstalment:
			record.monthlyInstalment === null ? null : roundPayrollAmount(record.monthlyInstalment),
		outstandingBalance:
			record.outstandingBalance === null ? null : roundPayrollAmount(record.outstandingBalance),
		totalPrincipalPaid,
		totalInterestPaid,
		totalPaid: roundPayrollAmount(totalPrincipalPaid + totalInterestPaid),
		remainingInstalments: Math.max(approvedInstalments - record.instalmentsPaid, 0),
	};
}

function parseLoanRepaymentRecord(record: LoanRepaymentRecord): LoanRepaymentView {
	return {
		...record,
		principalComponent: roundPayrollAmount(record.principalComponent),
		interestComponent: roundPayrollAmount(record.interestComponent),
		totalRepayment: roundPayrollAmount(record.totalRepayment),
		balanceBefore: roundPayrollAmount(record.balanceBefore),
		balanceAfter: roundPayrollAmount(record.balanceAfter),
	};
}

function ensureResult<T>(result: Result<T>): T {
	if (!result.success) {
		throw new Error(result.error.message);
	}

	return result.data;
}

function isLoanProcessed(status: LoanRecord["status"]) {
	return status !== LOAN_STATUS.PENDING;
}

function getLoanScheduleFromRecord(record: LoanRecord) {
	const principal = record.approvedAmount ?? record.principalAmount;
	const instalments = record.approvedInstalments ?? record.requestedInstalments;

	return computeLoanSchedule(principal, record.annualInterestRate, instalments);
}

function validateRepaymentStartPeriod(periodMonth: number, periodYear: number) {
	const periodIndex = getPeriodIndex(periodMonth, periodYear);
	const current = getCurrentPeriodParts();
	const currentIndex = getPeriodIndex(current.periodMonth, current.periodYear);

	if (periodIndex < currentIndex) {
		return failure({
			type: "ValidationError",
			message: "Repayment start period cannot be in the past",
		});
	}

	return success(undefined);
}

async function getEmployeeForLoan(employeeId: string) {
	return db.query.employees.findFirst({
		columns: {
			id: true,
			employeeNo: true,
			firstName: true,
			lastName: true,
			status: true,
			jobTitle: true,
			departmentId: true,
			deletedAt: true,
		},
		where: and(eq(employees.id, employeeId), isNull(employees.deletedAt)),
	});
}

async function getLoanRecord(loanId: string) {
	return db.query.employeeLoans.findFirst({
		where: eq(employeeLoans.id, loanId),
	});
}

async function getActiveAssetAccount(accountId: number) {
	return db.query.ledgerAccounts.findFirst({
		columns: {
			id: true,
			code: true,
			name: true,
			type: true,
			isActive: true,
			isPosting: true,
		},
		where: eq(ledgerAccounts.id, accountId),
	});
}

async function getLoansReceivableAccountId() {
	const mapping = await db.query.payrollAccountMappings.findFirst({
		where: eq(payrollAccountMappings.role, "loans_receivable"),
		with: {
			account: {
				columns: {
					id: true,
					isActive: true,
					isPosting: true,
					type: true,
				},
			},
		},
	});

	if (!mapping?.account || !mapping.account.isActive || !mapping.account.isPosting) {
		return failure({
			type: "ValidationError",
			message: "Payroll account mapping for Employee Loans Receivable is missing or inactive.",
		});
	}

	if (mapping.account.type !== "asset") {
		return failure({
			type: "ValidationError",
			message: "Employee Loans Receivable must be mapped to an asset account.",
		});
	}

	return success(mapping.account.id);
}

async function validateDisbursementOrSettlementAccount(accountId: number) {
	const account = await getActiveAssetAccount(accountId);

	if (!account || !account.isActive) {
		return failure({
			type: "ValidationError",
			message: "The selected account does not exist or is inactive.",
		});
	}

	if (!account.isPosting) {
		return failure({
			type: "ValidationError",
			message: "The selected account must be a posting account.",
		});
	}

	if (account.type !== "asset") {
		return failure({
			type: "ValidationError",
			message: "The selected disbursement account must be an asset account.",
		});
	}

	return success(account);
}

async function getLoanFormOptions(): Promise<LoanFormOptions> {
	const [employeeRows, departmentRows, accountRows] = await Promise.all([
		db
			.select({
				id: employees.id,
				employeeNo: employees.employeeNo,
				fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				departmentId: employees.departmentId,
			})
			.from(employees)
			.where(and(eq(employees.status, "active"), isNull(employees.deletedAt)))
			.orderBy(asc(employees.firstName), asc(employees.lastName)),
		db
			.select({
				id: departments.id,
				name: departments.name,
			})
			.from(departments)
			.orderBy(asc(departments.name)),
		db
			.select({
				id: ledgerAccounts.id,
				code: ledgerAccounts.code,
				name: ledgerAccounts.name,
			})
			.from(ledgerAccounts)
			.where(
				and(
					eq(ledgerAccounts.type, "asset"),
					eq(ledgerAccounts.isActive, true),
					eq(ledgerAccounts.isPosting, true)
				)
			)
			.orderBy(asc(ledgerAccounts.code), asc(ledgerAccounts.name)),
	]);

	return {
		employees: employeeRows,
		departments: departmentRows,
		disbursementAccounts: accountRows,
	};
}

async function applyForLoan({
	payload,
	createdBy,
}: {
	payload: ApplyForLoanPayload;
	createdBy: string;
}): Promise<Result<LoanApplicationResponse>> {
	const employee = await getEmployeeForLoan(payload.employeeId);

	if (!employee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	if (employee.status !== "active") {
		return failure({
			type: "ValidationError",
			message: "Loans can only be applied for active employees",
		});
	}

	if (payload.principalAmount <= 0) {
		return failure({
			type: "ValidationError",
			message: "Principal amount must be greater than zero",
		});
	}

	if (payload.requestedInstalments < 1 || payload.requestedInstalments > 60) {
		return failure({
			type: "ValidationError",
			message: "Requested instalments must be between 1 and 60",
		});
	}

	if (payload.annualInterestRate < 0 || payload.annualInterestRate > 1) {
		return failure({
			type: "ValidationError",
			message:
				"Interest rate must be between 0 and 1, for example 0.1 for 10%, 0 for interest-free",
		});
	}

	const schedulePreview = computeLoanSchedule(
		payload.principalAmount,
		payload.annualInterestRate,
		payload.requestedInstalments
	);

	try {
		const [record] = await db
			.insert(employeeLoans)
			.values({
				employeeId: payload.employeeId,
				principalAmount: toPayrollDecimalString(payload.principalAmount),
				annualInterestRate: toPayrollBig(
					payload.annualInterestRate ?? LOAN_DEFAULT_INTEREST_RATE
				).toFixed(4),
				requestedInstalments: payload.requestedInstalments,
				purpose: normalizeText(payload.purpose),
				status: LOAN_STATUS.PENDING,
			})
			.returning();

		await logActivity({
			data: {
				action: "apply for employee loan",
				description: `Created employee loan application ${record.id} for employee ${payload.employeeId}`,
				userId: createdBy,
			},
		});

		return success({
			loan: parseLoanRecord(record),
			schedulePreview,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create loan application",
		});
	}
}

async function approveLoan({
	loanId,
	payload,
	approverId,
}: {
	loanId: string;
	payload: ApproveLoanPayload;
	approverId: string;
}): Promise<Result<LoanApprovalResponse>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	if (isLoanProcessed(loan.status)) {
		return failure({
			type: "ValidationError",
			message: `Only pending loans can be approved. This loan is ${loan.status}.`,
		});
	}

	const employee = await getEmployeeForLoan(loan.employeeId);

	if (!employee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	if (payload.approvedAmount <= 0) {
		return failure({
			type: "ValidationError",
			message: "Approved amount must be greater than zero",
		});
	}

	if (payload.approvedInstalments < 1 || payload.approvedInstalments > 60) {
		return failure({
			type: "ValidationError",
			message: "Approved instalments must be between 1 and 60",
		});
	}

	const repaymentPeriodValidation = validateRepaymentStartPeriod(
		payload.repaymentStartMonth,
		payload.repaymentStartYear
	);

	if (!repaymentPeriodValidation.success) {
		return repaymentPeriodValidation;
	}

	const accountValidation = await validateDisbursementOrSettlementAccount(
		payload.disbursementAccountId
	);

	if (!accountValidation.success) {
		return accountValidation;
	}

	const receivableAccountResult = await getLoansReceivableAccountId();

	if (!receivableAccountResult.success) {
		return receivableAccountResult;
	}

	const schedule = computeLoanSchedule(
		payload.approvedAmount,
		loan.annualInterestRate,
		payload.approvedInstalments
	);
	const monthlyInstalment = schedule.monthlyInstalment;
	const today = getTodayDateString();
	const journalLines = [
		{
			accountId: receivableAccountResult.data,
			amount: toPayrollDecimalString(payload.approvedAmount),
			dc: "debit" as const,
			lineNumber: 1,
			memo: `Loan disbursement ${loan.id}`,
		},
		{
			accountId: payload.disbursementAccountId,
			amount: toPayrollDecimalString(payload.approvedAmount),
			dc: "credit" as const,
			lineNumber: 2,
			memo: `Loan disbursement ${loan.id}`,
		},
	];

	if (!areJournalValuesBalanced(journalLines)) {
		return failure({
			type: "ApplicationError",
			message: "Loan disbursement journal is not balanced",
		});
	}

	try {
		const approvedRecord = await db.transaction(async (tx) => {
			const journalEntryId = await createJournalEntry({
				entry: {
					entryDate: today,
					source: "loan_disbursement",
					sourceId: loanId,
					description: `Loan disbursement - ${employee.firstName} ${employee.lastName} - ${loanId}`,
					reference: loanId,
				},
				lines: journalLines,
				tx,
			});

			const [updated] = await tx
				.update(employeeLoans)
				.set({
					status: LOAN_STATUS.ACTIVE,
					approvedBy: approverId,
					approvedAt: new Date(),
					approvedAmount: toPayrollDecimalString(payload.approvedAmount),
					approvedInstalments: payload.approvedInstalments,
					disbursementAccountId: payload.disbursementAccountId,
					disbursementDate: today,
					repaymentStartMonth: payload.repaymentStartMonth,
					repaymentStartYear: payload.repaymentStartYear,
					monthlyInstalment: toPayrollDecimalString(monthlyInstalment),
					outstandingBalance: toPayrollDecimalString(payload.approvedAmount),
					disbursementJournalEntryId: journalEntryId,
					notes: normalizeText(payload.notes),
				})
				.where(eq(employeeLoans.id, loanId))
				.returning();

			return updated;
		});

		return success({
			loan: parseLoanRecord(approvedRecord),
			schedule,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to approve loan",
		});
	}
}

async function rejectLoan({
	loanId,
	rejectedBy,
	rejectionReason,
}: {
	loanId: string;
	rejectedBy: string;
	rejectionReason: string;
}): Promise<Result<LoanView>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	if (loan.status !== LOAN_STATUS.PENDING) {
		return failure({
			type: "ValidationError",
			message: `Only pending loans can be rejected. This loan is ${loan.status}.`,
		});
	}

	try {
		const [updated] = await db
			.update(employeeLoans)
			.set({
				status: LOAN_STATUS.REJECTED,
				rejectedBy,
				rejectedAt: new Date(),
				rejectionReason: rejectionReason.trim(),
			})
			.where(eq(employeeLoans.id, loanId))
			.returning();

		return success(parseLoanRecord(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to reject loan",
		});
	}
}

async function pauseLoanRepayments({
	loanId,
	pausedBy,
	notes,
}: {
	loanId: string;
	pausedBy: string;
	notes: string | null;
}): Promise<Result<LoanView>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	if (loan.status !== LOAN_STATUS.ACTIVE) {
		return failure({
			type: "ValidationError",
			message: `Only active loans can be paused. This loan is ${loan.status}.`,
		});
	}

	try {
		const [updated] = await db
			.update(employeeLoans)
			.set({
				status: LOAN_STATUS.PAUSED,
				pausedBy,
				pausedAt: new Date(),
				notes: normalizeText(notes) ?? loan.notes,
			})
			.where(eq(employeeLoans.id, loanId))
			.returning();

		return success(parseLoanRecord(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to pause loan repayments",
		});
	}
}

async function resumeLoanRepayments({
	loanId,
	resumedBy,
	repaymentStartMonth,
	repaymentStartYear,
	notes,
}: {
	loanId: string;
	resumedBy: string;
	repaymentStartMonth: number;
	repaymentStartYear: number;
	notes: string | null;
}): Promise<Result<LoanView>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	if (loan.status !== LOAN_STATUS.PAUSED) {
		return failure({
			type: "ValidationError",
			message: `Only paused loans can be resumed. This loan is ${loan.status}.`,
		});
	}

	const repaymentPeriodValidation = validateRepaymentStartPeriod(
		repaymentStartMonth,
		repaymentStartYear
	);

	if (!repaymentPeriodValidation.success) {
		return repaymentPeriodValidation;
	}

	try {
		const [updated] = await db
			.update(employeeLoans)
			.set({
				status: LOAN_STATUS.ACTIVE,
				resumedBy,
				resumedAt: new Date(),
				repaymentStartMonth,
				repaymentStartYear,
				notes: normalizeText(notes) ?? loan.notes,
			})
			.where(eq(employeeLoans.id, loanId))
			.returning();

		return success(parseLoanRecord(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to resume loan repayments",
		});
	}
}

async function settleEarly({
	loanId,
	settlementAmount,
	disbursementAccountId,
	settledBy,
	notes,
}: {
	loanId: string;
	settlementAmount: number;
	disbursementAccountId: number;
	settledBy: string;
	notes: string | null;
}): Promise<Result<LoanSettlementResponse>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	if (loan.status !== LOAN_STATUS.ACTIVE) {
		return failure({
			type: "ValidationError",
			message: `Only active loans can be settled early. This loan is ${loan.status}.`,
		});
	}

	if (loan.outstandingBalance === null) {
		return failure({
			type: "ValidationError",
			message: "Loan has no outstanding balance to settle",
		});
	}

	const employee = await getEmployeeForLoan(loan.employeeId);

	if (!employee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	const accountValidation = await validateDisbursementOrSettlementAccount(disbursementAccountId);

	if (!accountValidation.success) {
		return accountValidation;
	}

	const receivableAccountResult = await getLoansReceivableAccountId();

	if (!receivableAccountResult.success) {
		return receivableAccountResult;
	}

	const currentOutstandingBalance = roundPayrollAmount(loan.outstandingBalance);
	const settlementBreakdown = computeSingleInstalment(
		currentOutstandingBalance,
		loan.annualInterestRate
	);
	const expectedSettlementAmount = settlementBreakdown.totalPayment;
	const tolerance = 1;

	if (Math.abs(roundPayrollAmount(settlementAmount) - expectedSettlementAmount) > tolerance) {
		return failure({
			type: "ValidationError",
			message: `Settlement amount must match the expected settlement amount of KES ${expectedSettlementAmount.toFixed(2)}.`,
		});
	}

	const today = getTodayDateString();
	const currentPeriod = getCurrentPeriodParts();
	const journalLines = [
		{
			accountId: disbursementAccountId,
			amount: toPayrollDecimalString(expectedSettlementAmount),
			dc: "debit" as const,
			lineNumber: 1,
			memo: `Early settlement ${loanId}`,
		},
		{
			accountId: receivableAccountResult.data,
			amount: toPayrollDecimalString(expectedSettlementAmount),
			dc: "credit" as const,
			lineNumber: 2,
			memo: `Early settlement ${loanId}`,
		},
	];

	if (!areJournalValuesBalanced(journalLines)) {
		return failure({
			type: "ApplicationError",
			message: "Loan settlement journal is not balanced",
		});
	}

	try {
		const result = await db.transaction(async (tx) => {
			const journalEntryId = await createJournalEntry({
				entry: {
					entryDate: today,
					source: "loan_settlement",
					sourceId: loanId,
					description: `Early loan settlement - ${employee.firstName} ${employee.lastName} - ${loanId}`,
					reference: loanId,
				},
				lines: journalLines,
				tx,
			});

			const [repayment] = await tx
				.insert(loanRepayments)
				.values({
					loanId,
					employeeId: loan.employeeId,
					repaymentDate: today,
					periodMonth: currentPeriod.periodMonth,
					periodYear: currentPeriod.periodYear,
					principalComponent: toPayrollDecimalString(settlementBreakdown.principalComponent),
					interestComponent: toPayrollDecimalString(settlementBreakdown.interestComponent),
					totalRepayment: toPayrollDecimalString(settlementBreakdown.totalPayment),
					balanceBefore: toPayrollDecimalString(currentOutstandingBalance),
					balanceAfter: "0.00",
					isEarlySettlement: true,
					journalEntryId,
					notes: normalizeText(notes),
				})
				.returning();

			const [updatedLoan] = await tx
				.update(employeeLoans)
				.set({
					status: LOAN_STATUS.FULLY_PAID,
					outstandingBalance: "0.00",
					settledDate: today,
					totalPrincipalPaid: toPayrollDecimalString(
						roundPayrollAmount(loan.totalPrincipalPaid) + settlementBreakdown.principalComponent
					),
					totalInterestPaid: toPayrollDecimalString(
						roundPayrollAmount(loan.totalInterestPaid) + settlementBreakdown.interestComponent
					),
					instalmentsPaid: loan.instalmentsPaid + 1,
					settlementJournalEntryId: journalEntryId,
					notes: normalizeText(notes) ?? loan.notes,
				})
				.where(eq(employeeLoans.id, loanId))
				.returning();

			return {
				loan: updatedLoan,
				repayment,
			};
		});

		await logActivity({
			data: {
				action: "settle employee loan",
				description: `Settled employee loan ${loanId}`,
				userId: settledBy,
			},
		});

		return success({
			loan: parseLoanRecord(result.loan),
			repayment: parseLoanRepaymentRecord(result.repayment),
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to settle loan early",
		});
	}
}

async function getActiveLoansForEmployee(
	employeeId: string,
	periodMonth = getCurrentPeriodParts().periodMonth,
	periodYear = getCurrentPeriodParts().periodYear
): Promise<Result<Array<LoanView>>> {
	const targetIndex = getPeriodIndex(periodMonth, periodYear);
	const rows = await db.query.employeeLoans.findMany({
		where: and(
			eq(employeeLoans.employeeId, employeeId),
			eq(employeeLoans.status, LOAN_STATUS.ACTIVE),
			lte(
				sql<number>`${employeeLoans.repaymentStartYear} * 100 + ${employeeLoans.repaymentStartMonth}`,
				targetIndex
			)
		),
		orderBy: [asc(employeeLoans.disbursementDate), asc(employeeLoans.id)],
	});

	return success(
		rows
			.filter((loan) => loan.monthlyInstalment !== null && loan.outstandingBalance !== null)
			.map(parseLoanRecord)
	);
}

async function getTotalMonthlyLoanObligations(
	employeeId: string,
	periodMonth: number,
	periodYear: number
): Promise<Result<TotalMonthlyLoanObligationResponse>> {
	const activeLoansResult = await getActiveLoansForEmployee(employeeId, periodMonth, periodYear);

	if (!activeLoansResult.success) {
		return activeLoansResult;
	}

	const items = activeLoansResult.data.map((loan) => ({
		loanId: loan.id,
		monthlyInstalment: loan.monthlyInstalment ?? 0,
		outstandingBalance: loan.outstandingBalance ?? 0,
		annualInterestRate: loan.annualInterestRate,
	}));

	return success({
		employeeId,
		items,
		totalMonthlyInstalment: roundPayrollAmount(
			items.reduce((sum, item) => sum + item.monthlyInstalment, 0)
		),
	});
}

function isLoanRepaymentUniqueViolation(error: unknown) {
	return Boolean(
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "23505" &&
		"constraint" in error &&
		error.constraint === "uq_loan_repayments_period_non_early"
	);
}

async function processPayrollLoanRepayment({
	loanId,
	periodMonth,
	periodYear,
	payrollSlipId,
}: z.infer<typeof payrollLoanRepaymentSchema>): Promise<Result<LoanRepaymentView>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	if (loan.status !== LOAN_STATUS.ACTIVE) {
		return failure({
			type: "ValidationError",
			message: `Only active loans can be processed. This loan is ${loan.status}.`,
		});
	}

	if (loan.outstandingBalance === null || loan.monthlyInstalment === null) {
		return failure({
			type: "ValidationError",
			message: "Loan is missing repayment configuration",
		});
	}

	const existingRepayment = await db.query.loanRepayments.findFirst({
		where: and(
			eq(loanRepayments.loanId, loanId),
			eq(loanRepayments.periodMonth, periodMonth),
			eq(loanRepayments.periodYear, periodYear),
			eq(loanRepayments.isEarlySettlement, false)
		),
	});

	if (existingRepayment) {
		return failure({
			type: "ConflictError",
			message: "A payroll repayment already exists for this loan and period",
		});
	}

	const balanceBefore = roundPayrollAmount(loan.outstandingBalance);
	const breakdown = computeSingleInstalment(
		balanceBefore,
		loan.annualInterestRate,
		loan.monthlyInstalment
	);
	const repaymentDate = getTodayDateString();

	try {
		const repayment = await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(loanRepayments)
				.values({
					loanId,
					employeeId: loan.employeeId,
					repaymentDate,
					periodMonth,
					periodYear,
					principalComponent: toPayrollDecimalString(breakdown.principalComponent),
					interestComponent: toPayrollDecimalString(breakdown.interestComponent),
					totalRepayment: toPayrollDecimalString(breakdown.totalPayment),
					balanceBefore: toPayrollDecimalString(balanceBefore),
					balanceAfter: toPayrollDecimalString(breakdown.balanceAfter),
					isEarlySettlement: false,
					payrollSlipId,
				})
				.returning();

			await tx
				.update(employeeLoans)
				.set({
					outstandingBalance: toPayrollDecimalString(
						breakdown.balanceAfter <= 0 ? 0 : breakdown.balanceAfter
					),
					totalPrincipalPaid: toPayrollDecimalString(
						roundPayrollAmount(loan.totalPrincipalPaid) + breakdown.principalComponent
					),
					totalInterestPaid: toPayrollDecimalString(
						roundPayrollAmount(loan.totalInterestPaid) + breakdown.interestComponent
					),
					instalmentsPaid: loan.instalmentsPaid + 1,
					status: breakdown.balanceAfter <= 0 ? LOAN_STATUS.FULLY_PAID : LOAN_STATUS.ACTIVE,
					settledDate: breakdown.balanceAfter <= 0 ? repaymentDate : loan.settledDate,
				})
				.where(eq(employeeLoans.id, loanId));

			return created;
		});

		return success(parseLoanRepaymentRecord(repayment));
	} catch (error) {
		if (isLoanRepaymentUniqueViolation(error)) {
			return failure({
				type: "ConflictError",
				message: "A payroll repayment already exists for this loan and period",
			});
		}

		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to process payroll loan repayment",
		});
	}
}

async function getLoanById(loanId: string): Promise<Result<LoanDetailView>> {
	const row = await db
		.select({
			id: employeeLoans.id,
			employeeId: employeeLoans.employeeId,
			applicationDate: employeeLoans.applicationDate,
			principalAmount: employeeLoans.principalAmount,
			annualInterestRate: employeeLoans.annualInterestRate,
			requestedInstalments: employeeLoans.requestedInstalments,
			purpose: employeeLoans.purpose,
			status: employeeLoans.status,
			approvedBy: employeeLoans.approvedBy,
			approvedAt: employeeLoans.approvedAt,
			approvedAmount: employeeLoans.approvedAmount,
			approvedInstalments: employeeLoans.approvedInstalments,
			disbursementAccountId: employeeLoans.disbursementAccountId,
			disbursementDate: employeeLoans.disbursementDate,
			repaymentStartMonth: employeeLoans.repaymentStartMonth,
			repaymentStartYear: employeeLoans.repaymentStartYear,
			monthlyInstalment: employeeLoans.monthlyInstalment,
			disbursementJournalEntryId: employeeLoans.disbursementJournalEntryId,
			rejectedBy: employeeLoans.rejectedBy,
			rejectedAt: employeeLoans.rejectedAt,
			rejectionReason: employeeLoans.rejectionReason,
			outstandingBalance: employeeLoans.outstandingBalance,
			totalPrincipalPaid: employeeLoans.totalPrincipalPaid,
			totalInterestPaid: employeeLoans.totalInterestPaid,
			instalmentsPaid: employeeLoans.instalmentsPaid,
			pausedBy: employeeLoans.pausedBy,
			pausedAt: employeeLoans.pausedAt,
			resumedBy: employeeLoans.resumedBy,
			resumedAt: employeeLoans.resumedAt,
			settledDate: employeeLoans.settledDate,
			settlementJournalEntryId: employeeLoans.settlementJournalEntryId,
			notes: employeeLoans.notes,
			createdAt: employeeLoans.createdAt,
			updatedAt: employeeLoans.updatedAt,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			jobTitle: employees.jobTitle,
			departmentId: employees.departmentId,
			departmentName: departments.name,
		})
		.from(employeeLoans)
		.innerJoin(employees, eq(employeeLoans.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(eq(employeeLoans.id, loanId))
		.then((rows) => rows[0] ?? null);

	if (!row) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	const repayments = await db.query.loanRepayments.findMany({
		where: eq(loanRepayments.loanId, loanId),
		orderBy: [asc(loanRepayments.repaymentDate), asc(loanRepayments.createdAt)],
	});
	const actorIds = [row.approvedBy, row.rejectedBy, row.pausedBy, row.resumedBy].filter(
		(value): value is string => Boolean(value)
	);
	const actorRows =
		actorIds.length > 0
			? await db.query.users.findMany({
					columns: {
						id: true,
						name: true,
					},
					where: inArray(users.id, actorIds),
				})
			: [];
	const actorNameById = new Map(actorRows.map((actor) => [actor.id, actor.name]));
	const parsedLoan = parseLoanRecord(row);

	return success({
		...parsedLoan,
		employeeNo: row.employeeNo,
		fullName: row.fullName,
		jobTitle: row.jobTitle,
		departmentId: row.departmentId,
		departmentName: row.departmentName,
		approvedByName: row.approvedBy ? (actorNameById.get(row.approvedBy) ?? null) : null,
		rejectedByName: row.rejectedBy ? (actorNameById.get(row.rejectedBy) ?? null) : null,
		pausedByName: row.pausedBy ? (actorNameById.get(row.pausedBy) ?? null) : null,
		resumedByName: row.resumedBy ? (actorNameById.get(row.resumedBy) ?? null) : null,
		repayments: repayments.map(parseLoanRepaymentRecord),
		schedule: getLoanScheduleFromRecord(row),
	});
}

async function getLoansByEmployee(
	employeeId: string,
	statusFilter?: LoanRecord["status"]
): Promise<Result<LoanView[]>> {
	const employee = await getEmployeeForLoan(employeeId);

	if (!employee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	const rows = await db.query.employeeLoans.findMany({
		where: and(
			eq(employeeLoans.employeeId, employeeId),
			statusFilter ? eq(employeeLoans.status, statusFilter) : undefined
		),
		orderBy: [desc(employeeLoans.applicationDate), desc(employeeLoans.createdAt)],
	});

	return success(rows.map(parseLoanRecord));
}

async function getLoanLedger(loanId: string): Promise<Result<LoanLedgerView>> {
	const loan = await getLoanRecord(loanId);

	if (!loan) {
		return failure({
			type: "NotFoundError",
			message: "Loan not found",
		});
	}

	const repayments = await db.query.loanRepayments.findMany({
		where: eq(loanRepayments.loanId, loanId),
		orderBy: [asc(loanRepayments.repaymentDate), asc(loanRepayments.createdAt)],
	});

	return success({
		loanId,
		openingBalance: roundPayrollAmount(loan.approvedAmount ?? loan.principalAmount),
		closingOutstandingBalance: roundPayrollAmount(loan.outstandingBalance ?? 0),
		entries: repayments.map((repayment) => ({
			date: repayment.repaymentDate,
			principal: roundPayrollAmount(repayment.principalComponent),
			interest: roundPayrollAmount(repayment.interestComponent),
			total: roundPayrollAmount(repayment.totalRepayment),
			balanceBefore: roundPayrollAmount(repayment.balanceBefore),
			balanceAfter: roundPayrollAmount(repayment.balanceAfter),
			isEarlySettlement: repayment.isEarlySettlement,
		})),
	});
}

function buildLoanListConditions(filters: AllActiveLoansFilters) {
	const conditions: Array<SQL | undefined> = [isNull(employees.deletedAt)];
	const query = filters.q?.trim();
	const status = filters.status;

	if (status && status !== "all") {
		conditions.push(eq(employeeLoans.status, status));
	}

	if (filters.departmentId) {
		conditions.push(eq(employees.departmentId, filters.departmentId));
	}

	if (filters.employeeId) {
		conditions.push(eq(employeeLoans.employeeId, filters.employeeId));
	}

	if (query) {
		const searchQuery = `%${query}%`;
		conditions.push(
			or(
				ilike(employees.employeeNo, searchQuery),
				ilike(employees.firstName, searchQuery),
				ilike(employees.lastName, searchQuery),
				ilike(sql`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`, searchQuery)
			)
		);
	}

	return conditions;
}

async function getAllActiveLoans(filters: AllActiveLoansFilters): Promise<Array<LoanListItem>> {
	const rows = await db
		.select({
			id: employeeLoans.id,
			employeeId: employeeLoans.employeeId,
			applicationDate: employeeLoans.applicationDate,
			principalAmount: employeeLoans.principalAmount,
			annualInterestRate: employeeLoans.annualInterestRate,
			requestedInstalments: employeeLoans.requestedInstalments,
			purpose: employeeLoans.purpose,
			status: employeeLoans.status,
			approvedBy: employeeLoans.approvedBy,
			approvedAt: employeeLoans.approvedAt,
			approvedAmount: employeeLoans.approvedAmount,
			approvedInstalments: employeeLoans.approvedInstalments,
			disbursementAccountId: employeeLoans.disbursementAccountId,
			disbursementDate: employeeLoans.disbursementDate,
			repaymentStartMonth: employeeLoans.repaymentStartMonth,
			repaymentStartYear: employeeLoans.repaymentStartYear,
			monthlyInstalment: employeeLoans.monthlyInstalment,
			disbursementJournalEntryId: employeeLoans.disbursementJournalEntryId,
			rejectedBy: employeeLoans.rejectedBy,
			rejectedAt: employeeLoans.rejectedAt,
			rejectionReason: employeeLoans.rejectionReason,
			outstandingBalance: employeeLoans.outstandingBalance,
			totalPrincipalPaid: employeeLoans.totalPrincipalPaid,
			totalInterestPaid: employeeLoans.totalInterestPaid,
			instalmentsPaid: employeeLoans.instalmentsPaid,
			pausedBy: employeeLoans.pausedBy,
			pausedAt: employeeLoans.pausedAt,
			resumedBy: employeeLoans.resumedBy,
			resumedAt: employeeLoans.resumedAt,
			settledDate: employeeLoans.settledDate,
			settlementJournalEntryId: employeeLoans.settlementJournalEntryId,
			notes: employeeLoans.notes,
			createdAt: employeeLoans.createdAt,
			updatedAt: employeeLoans.updatedAt,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			jobTitle: employees.jobTitle,
			departmentId: employees.departmentId,
			departmentName: departments.name,
		})
		.from(employeeLoans)
		.innerJoin(employees, eq(employeeLoans.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(and(...buildLoanListConditions(filters)))
		.orderBy(desc(employeeLoans.applicationDate), desc(employeeLoans.createdAt));

	return rows.map((row) => ({
		...parseLoanRecord(row),
		employeeNo: row.employeeNo,
		fullName: row.fullName,
		jobTitle: row.jobTitle,
		departmentId: row.departmentId,
		departmentName: row.departmentName,
	}));
}

async function requireLoanViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:view");
}

async function requireLoanCreateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:create");
}

async function requireLoanApproveAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:approve");
}

async function requireLoanRejectAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:reject");
}

async function requireLoanPauseAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:pause");
}

async function requireLoanResumeAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:resume");
}

async function requireLoanSettlementAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("employee-loans:settle");
}

export const getLoanFormOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireLoanViewAccess();
		return getLoanFormOptions();
	});

export const getAllActiveLoansFn = createServerFn()
	.middleware([authMiddleware])
	.validator(allActiveLoansFilterSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return getAllActiveLoans(data);
	});

export const getLoanByIdFn = createServerFn()
	.middleware([authMiddleware])
	.validator(loanByIdSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return ensureResult(await getLoanById(data.loanId));
	});

export const getLoansByEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(loansByEmployeeSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return ensureResult(await getLoansByEmployee(data.employeeId, data.statusFilter));
	});

export const getLoanLedgerFn = createServerFn()
	.middleware([authMiddleware])
	.validator(loanByIdSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return ensureResult(await getLoanLedger(data.loanId));
	});

export const getActiveLoansForEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(activeLoansForEmployeeSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return ensureResult(await getActiveLoansForEmployee(data.employeeId));
	});

export const getTotalMonthlyLoanObligationsFn = createServerFn()
	.middleware([authMiddleware])
	.validator(totalMonthlyLoanObligationsSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return ensureResult(
			await getTotalMonthlyLoanObligations(data.employeeId, data.periodMonth, data.periodYear)
		);
	});

export const applyForLoanFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(applyForLoanSchema)
	.handler(async ({ data, context }) => {
		await requireLoanCreateAccess();
		return applyForLoan({
			payload: data,
			createdBy: context.user.id,
		});
	});

export const approveLoanFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(approveLoanSchema)
	.handler(async ({ data, context }) => {
		await requireLoanApproveAccess();
		const result = await approveLoan({
			loanId: data.loanId,
			payload: data.payload,
			approverId: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "approve employee loan",
					description: `Approved employee loan ${data.loanId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const rejectLoanFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(rejectLoanSchema)
	.handler(async ({ data, context }) => {
		await requireLoanRejectAccess();
		const result = await rejectLoan({
			loanId: data.loanId,
			rejectedBy: context.user.id,
			rejectionReason: data.rejectionReason,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "reject employee loan",
					description: `Rejected employee loan ${data.loanId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const pauseLoanRepaymentsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(pauseLoanSchema)
	.handler(async ({ data, context }) => {
		await requireLoanPauseAccess();
		const result = await pauseLoanRepayments({
			loanId: data.loanId,
			pausedBy: context.user.id,
			notes: data.notes,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "pause employee loan",
					description: `Paused employee loan ${data.loanId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const resumeLoanRepaymentsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(resumeLoanSchema)
	.handler(async ({ data, context }) => {
		await requireLoanResumeAccess();
		const result = await resumeLoanRepayments({
			loanId: data.loanId,
			resumedBy: context.user.id,
			repaymentStartMonth: data.repaymentStartMonth,
			repaymentStartYear: data.repaymentStartYear,
			notes: data.notes,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "resume employee loan",
					description: `Resumed employee loan ${data.loanId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const settleEarlyFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(settleEarlySchema)
	.handler(async ({ data, context }) => {
		await requireLoanSettlementAccess();
		return settleEarly({
			loanId: data.loanId,
			settlementAmount: data.settlementAmount,
			disbursementAccountId: data.disbursementAccountId,
			settledBy: context.user.id,
			notes: data.notes,
		});
	});

export const processPayrollLoanRepaymentFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollLoanRepaymentSchema)
	.handler(async ({ data }) => {
		await requireLoanViewAccess();
		return processPayrollLoanRepayment(data);
	});

export type LoanFormOptionsResponse = Awaited<ReturnType<typeof getLoanFormOptionsFn>>;
export type LoanListItemView = Awaited<ReturnType<typeof getAllActiveLoansFn>>[number];
export type LoanDetailResponse = Awaited<ReturnType<typeof getLoanByIdFn>>;
export type LoanLedgerResponse = Awaited<ReturnType<typeof getLoanLedgerFn>>;
