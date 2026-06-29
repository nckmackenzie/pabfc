import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { format, isBefore, set, startOfMonth, startOfToday } from "date-fns";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
	departments,
	employees,
	ledgerAccounts,
	salaryAdvanceRecoveries,
	salaryAdvances,
	salaryStructures,
	users,
} from "@/drizzle/schema";
import { getAccountMappingsAsMapFn } from "@/features/payroll/services/account-mappings.api";
import { computeGrossPayComponents } from "@/features/payroll/lib/helpers";
import {
	computeSalaryAdvanceMonthlyRecoveryAmount,
	computeSalaryAdvanceRecoveryStep,
} from "@/features/payroll/lib/salary-advance-helpers";
import {
	PAYROLL_MONTH_MAX,
	PAYROLL_MONTH_MIN,
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
	SALARY_ADVANCE_MAX_ADVANCE_RATIO,
	SALARY_ADVANCE_MAX_RECOVERY_MONTHS,
	SALARY_ADVANCE_STATUS,
} from "@/features/payroll/lib/payroll-constants";
import {
	activeSalaryAdvancesForEmployeeSchema,
	allActiveSalaryAdvancesFilterSchema,
	applyForSalaryAdvanceSchema,
	approveSalaryAdvanceSchema,
	cancelSalaryAdvanceSchema,
	payrollAdvanceRecoverySchema,
	rejectSalaryAdvanceSchema,
	salaryAdvanceByIdSchema,
	salaryAdvancesByEmployeeSchema,
	totalMonthlyAdvanceRecoveriesSchema,
} from "@/features/payroll/services/salary-advance.schemas";
import { normalizeText, roundDecimal, toDecimalString } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import { getEligibleEmployee } from "@/features/employees/services/employee.server";

type SalaryAdvanceRecord = typeof salaryAdvances.$inferSelect;
type SalaryAdvanceRecoveryRecord = typeof salaryAdvanceRecoveries.$inferSelect;
type SalaryAdvanceStatus = (typeof SALARY_ADVANCE_STATUS)[keyof typeof SALARY_ADVANCE_STATUS];
type SalaryAdvanceNumericFields = {
	approvedAmount: number | null;
	monthlyRecoveryAmount: number | null;
	outstandingBalance: number | null;
	requestedAmount: number;
	totalRecovered: number;
};
type SalaryAdvanceRecoveryNumericFields = {
	balanceAfter: number;
	balanceBefore: number;
	recoveryAmount: number;
};
type ApplyForSalaryAdvancePayload = z.infer<typeof applyForSalaryAdvanceSchema>;
type ApproveSalaryAdvancePayload = z.infer<typeof approveSalaryAdvanceSchema>["payload"];
type ActiveSalaryAdvanceFilters = z.infer<typeof allActiveSalaryAdvancesFilterSchema>;

type SalaryAdvanceView = Omit<SalaryAdvanceRecord, keyof SalaryAdvanceNumericFields> &
	SalaryAdvanceNumericFields & {
		remainingRecoveries: number;
	};

type SalaryAdvanceRecoveryView = Omit<
	SalaryAdvanceRecoveryRecord,
	keyof SalaryAdvanceRecoveryNumericFields
> &
	SalaryAdvanceRecoveryNumericFields;

type SalaryAdvanceApplicationResponse = {
	advance: SalaryAdvanceView;
	warning: string | null;
};

type SalaryAdvanceFormOptions = {
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

type SalaryAdvanceListItem = SalaryAdvanceView & {
	departmentId: number | null;
	departmentName: string | null;
	employeeNo: string;
	fullName: string;
	jobTitle: string | null;
};

type SalaryAdvanceDetailView = SalaryAdvanceListItem & {
	approvedByName: string | null;
	cancelledByName: string | null;
	recoveries: SalaryAdvanceRecoveryView[];
	rejectedByName: string | null;
};

type SalaryAdvanceStatementView = {
	advanceId: string;
	closingOutstandingBalance: number;
	entries: Array<{
		amount: number;
		balanceAfter: number;
		balanceBefore: number;
		date: string;
		isLastRecovery: boolean;
	}>;
	openingBalance: number;
};

type TotalMonthlyAdvanceRecoveriesResponse = {
	employeeId: string;
	items: Array<{
		advanceId: string;
		approvedRecoveryMonths: number | null;
		monthlyRecoveryAmount: number;
		outstandingBalance: number;
		recoveriesProcessed: number;
	}>;
	totalRecoveryAmount: number;
};

function getTodayDateString() {
	return format(new Date(), "yyyy-MM-dd");
}

function formatKesAmount(value: number) {
	return value.toLocaleString("en-KE", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function getPeriodStartDate(periodMonth: number, periodYear: number) {
	return startOfMonth(
		set(new Date(), {
			year: periodYear,
			month: periodMonth - 1,
			date: 1,
			hours: 0,
			minutes: 0,
			seconds: 0,
			milliseconds: 0,
		})
	);
}

function getCurrentPeriodStartDate() {
	return startOfMonth(startOfToday());
}

function isRecoveryPeriodInPast(periodMonth: number, periodYear: number) {
	return isBefore(getPeriodStartDate(periodMonth, periodYear), getCurrentPeriodStartDate());
}

function parseSalaryAdvanceRecord(record: SalaryAdvanceRecord): SalaryAdvanceView {
	const approvedRecoveryMonths = record.approvedRecoveryMonths ?? record.requestedRecoveryMonths;

	return {
		...record,
		requestedAmount: roundDecimal(record.requestedAmount),
		approvedAmount: record.approvedAmount === null ? null : roundDecimal(record.approvedAmount),
		monthlyRecoveryAmount:
			record.monthlyRecoveryAmount === null ? null : roundDecimal(record.monthlyRecoveryAmount),
		outstandingBalance:
			record.outstandingBalance === null ? null : roundDecimal(record.outstandingBalance),
		totalRecovered: roundDecimal(record.totalRecovered),
		remainingRecoveries: Math.max(approvedRecoveryMonths - record.recoveriesProcessed, 0),
	};
}

function parseSalaryAdvanceRecoveryRecord(
	record: SalaryAdvanceRecoveryRecord
): SalaryAdvanceRecoveryView {
	return {
		...record,
		recoveryAmount: roundDecimal(record.recoveryAmount),
		balanceBefore: roundDecimal(record.balanceBefore),
		balanceAfter: roundDecimal(record.balanceAfter),
	};
}

function ensureResult<T>(result: Result<T>): T {
	if (!result.success) {
		throw new Error(result.error.message);
	}

	return result.data;
}

async function getSalaryAdvanceRecord(advanceId: string) {
	return db.query.salaryAdvances.findFirst({
		where: eq(salaryAdvances.id, advanceId),
	});
}

async function getCurrentActiveSalaryStructure(employeeId: string) {
	const today = getTodayDateString();

	return db.query.salaryStructures.findFirst({
		where: and(
			eq(salaryStructures.employeeId, employeeId),
			lte(salaryStructures.effectiveFrom, today),
			or(isNull(salaryStructures.effectiveTo), gte(salaryStructures.effectiveTo, today))
		),
		orderBy: [desc(salaryStructures.effectiveFrom), desc(salaryStructures.id)],
	});
}

async function getActiveAssetAccount(accountId: number) {
	return db.query.ledgerAccounts.findFirst({
		columns: {
			code: true,
			id: true,
			isActive: true,
			isPosting: true,
			name: true,
			type: true,
		},
		where: eq(ledgerAccounts.id, accountId),
	});
}

async function validateDisbursementAccount(accountId: number) {
	const account = await getActiveAssetAccount(accountId);

	if (!account || !account.isActive) {
		return failure({
			type: "ValidationError",
			message: "The selected disbursement account does not exist or is inactive.",
		});
	}

	if (!account.isPosting) {
		return failure({
			type: "ValidationError",
			message: "The selected disbursement account must be a posting account.",
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

async function getSalaryAdvanceFormOptions(): Promise<SalaryAdvanceFormOptions> {
	const [employeeRows, departmentRows, accountRows] = await Promise.all([
		db
			.select({
				departmentId: employees.departmentId,
				employeeNo: employees.employeeNo,
				fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				id: employees.id,
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
				code: ledgerAccounts.code,
				id: ledgerAccounts.id,
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

async function findOutstandingAdvanceForEmployee(employeeId: string) {
	return db.query.salaryAdvances.findFirst({
		where: and(
			eq(salaryAdvances.employeeId, employeeId),
			inArray(salaryAdvances.status, [
				SALARY_ADVANCE_STATUS.APPROVED,
				SALARY_ADVANCE_STATUS.DISBURSED,
				SALARY_ADVANCE_STATUS.RECOVERING,
			])
		),
		orderBy: [desc(salaryAdvances.updatedAt), desc(salaryAdvances.createdAt)],
	});
}

async function applyForSalaryAdvance({
	payload,
	createdBy,
}: {
	payload: ApplyForSalaryAdvancePayload;
	createdBy: string;
}): Promise<Result<SalaryAdvanceApplicationResponse>> {
	const employeeResult = await getEligibleEmployee(payload.employeeId);
	if (!employeeResult.success) return employeeResult;

	if (
		payload.requestedRecoveryMonths < 1 ||
		payload.requestedRecoveryMonths > SALARY_ADVANCE_MAX_RECOVERY_MONTHS
	) {
		return failure({
			type: "ValidationError",
			message: `Requested recovery months must be between 1 and ${SALARY_ADVANCE_MAX_RECOVERY_MONTHS}.`,
		});
	}

	const outstandingAdvance = await findOutstandingAdvanceForEmployee(payload.employeeId);

	if (outstandingAdvance) {
		const outstandingBalance = roundDecimal(outstandingAdvance.outstandingBalance ?? 0);

		return failure({
			type: "ValidationError",
			message: `This employee already has an active salary advance with an outstanding balance of KES ${formatKesAmount(outstandingBalance)}.`,
		});
	}

	let warning: string | null = null;
	const currentStructure = await getCurrentActiveSalaryStructure(payload.employeeId);

	if (!currentStructure) {
		warning = "No active salary structure found. HR must verify advance amount manually.";
	} else {
		const grossPay = computeGrossPayComponents(currentStructure).grossPay;
		const maxAdvisoryAmount = roundDecimal(grossPay * SALARY_ADVANCE_MAX_ADVANCE_RATIO);

		if (payload.requestedAmount > maxAdvisoryAmount) {
			warning = `Requested amount exceeds ${SALARY_ADVANCE_MAX_ADVANCE_RATIO * 100}% of gross pay (KES ${formatKesAmount(grossPay)}). HR may wish to approve a lesser amount.`;
		}
	}

	try {
		const [record] = await db
			.insert(salaryAdvances)
			.values({
				employeeId: payload.employeeId,
				reason: normalizeText(payload.reason),
				requestedAmount: toDecimalString(payload.requestedAmount),
				requestedRecoveryMonths: payload.requestedRecoveryMonths,
				status: SALARY_ADVANCE_STATUS.PENDING,
			})
			.returning();

		await logActivity({
			data: {
				action: "apply for salary advance",
				description: `Created salary advance application ${record.id} for employee ${payload.employeeId}`,
				userId: createdBy,
			},
		});

		return success({
			advance: parseSalaryAdvanceRecord(record),
			warning,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create salary advance application.",
		});
	}
}

async function approveSalaryAdvance({
	advanceId,
	payload,
	approverId,
}: {
	advanceId: string;
	payload: ApproveSalaryAdvancePayload;
	approverId: string;
}): Promise<Result<SalaryAdvanceView>> {
	const advance = await getSalaryAdvanceRecord(advanceId);

	if (!advance) {
		return failure({
			type: "NotFoundError",
			message: "Salary advance not found.",
		});
	}

	if (advance.status !== SALARY_ADVANCE_STATUS.PENDING) {
		return failure({
			type: "ValidationError",
			message: `Only pending salary advances can be approved. This advance is ${advance.status}.`,
		});
	}

	const employeeResult = await getEligibleEmployee(advance.employeeId);

	if (!employeeResult.success) {
		return employeeResult;
	}
	const employee = employeeResult.data;

	if (
		payload.approvedRecoveryMonths < 1 ||
		payload.approvedRecoveryMonths > SALARY_ADVANCE_MAX_RECOVERY_MONTHS
	) {
		return failure({
			type: "ValidationError",
			message: `Approved recovery months must be between 1 and ${SALARY_ADVANCE_MAX_RECOVERY_MONTHS}.`,
		});
	}

	if (
		payload.recoveryStartMonth < PAYROLL_MONTH_MIN ||
		payload.recoveryStartMonth > PAYROLL_MONTH_MAX
	) {
		return failure({
			type: "ValidationError",
			message: `Recovery start month must be between ${PAYROLL_MONTH_MIN} and ${PAYROLL_MONTH_MAX}.`,
		});
	}

	if (
		payload.recoveryStartYear < PAYROLL_PERIOD_YEAR_MIN ||
		payload.recoveryStartYear > PAYROLL_PERIOD_YEAR_MAX
	) {
		return failure({
			type: "ValidationError",
			message: `Recovery start year must be between ${PAYROLL_PERIOD_YEAR_MIN} and ${PAYROLL_PERIOD_YEAR_MAX}.`,
		});
	}

	if (isRecoveryPeriodInPast(payload.recoveryStartMonth, payload.recoveryStartYear)) {
		return failure({
			type: "ValidationError",
			message: "Recovery start period cannot be in the past.",
		});
	}

	const accountValidation = await validateDisbursementAccount(payload.disbursementAccountId);

	if (!accountValidation.success) {
		return accountValidation;
	}

	const accountMappingsResult = await getAccountMappingsAsMapFn();

	if (!accountMappingsResult.success) {
		return accountMappingsResult;
	}

	const monthlyRecoveryAmount = computeSalaryAdvanceMonthlyRecoveryAmount(
		payload.approvedAmount,
		payload.approvedRecoveryMonths
	);
	const today = getTodayDateString();
	const employeeFullName = `${employee.firstName} ${employee.lastName}`.trim();
	const journalLines = [
		{
			accountId: accountMappingsResult.data.salary_advance_receivable,
			amount: toDecimalString(payload.approvedAmount),
			dc: "debit" as const,
			lineNumber: 1,
			memo: `Salary advance disbursement ${advanceId}`,
		},
		{
			accountId: payload.disbursementAccountId,
			amount: toDecimalString(payload.approvedAmount),
			dc: "credit" as const,
			lineNumber: 2,
			memo: `Salary advance disbursement ${advanceId}`,
		},
	];

	if (!areJournalValuesBalanced(journalLines)) {
		return failure({
			type: "ApplicationError",
			message: "Salary advance disbursement journal is not balanced.",
		});
	}

	try {
		const approvedRecord = await db.transaction(async (tx) => {
			const journalEntryId = await createJournalEntry({
				entry: {
					description: `Salary advance disbursement - ${employeeFullName} - ${advanceId}`,
					entryDate: today,
					reference: `ADVANCE-${advanceId}`,
					source: "salary_advance_disbursement",
					sourceId: advanceId,
				},
				lines: journalLines,
				tx,
			});

			const [updated] = await tx
				.update(salaryAdvances)
				.set({
					approvedAmount: toDecimalString(payload.approvedAmount),
					approvedAt: new Date(),
					approvedBy: approverId,
					approvedRecoveryMonths: payload.approvedRecoveryMonths,
					disbursementAccountId: payload.disbursementAccountId,
					disbursementDate: today,
					disbursementJournalEntryId: journalEntryId,
					monthlyRecoveryAmount: toDecimalString(monthlyRecoveryAmount),
					notes: normalizeText(payload.notes),
					outstandingBalance: toDecimalString(payload.approvedAmount),
					recoveryStartMonth: payload.recoveryStartMonth,
					recoveryStartYear: payload.recoveryStartYear,
					status: SALARY_ADVANCE_STATUS.DISBURSED,
				})
				.where(eq(salaryAdvances.id, advanceId))
				.returning();

			return updated;
		});

		return success(parseSalaryAdvanceRecord(approvedRecord));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to approve salary advance.",
		});
	}
}

async function rejectSalaryAdvance({
	advanceId,
	rejectedBy,
	rejectionReason,
}: {
	advanceId: string;
	rejectedBy: string;
	rejectionReason: string;
}): Promise<Result<SalaryAdvanceView>> {
	const advance = await getSalaryAdvanceRecord(advanceId);

	if (!advance) {
		return failure({
			type: "NotFoundError",
			message: "Salary advance not found.",
		});
	}

	if (advance.status !== SALARY_ADVANCE_STATUS.PENDING) {
		return failure({
			type: "ValidationError",
			message: `Only pending salary advances can be rejected. This advance is ${advance.status}.`,
		});
	}

	try {
		const [updated] = await db
			.update(salaryAdvances)
			.set({
				rejectedAt: new Date(),
				rejectedBy,
				rejectionReason: rejectionReason.trim(),
				status: SALARY_ADVANCE_STATUS.REJECTED,
			})
			.where(eq(salaryAdvances.id, advanceId))
			.returning();

		return success(parseSalaryAdvanceRecord(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to reject salary advance.",
		});
	}
}

async function cancelSalaryAdvance({
	advanceId,
	cancelledBy,
	cancellationReason,
}: {
	advanceId: string;
	cancelledBy: string;
	cancellationReason: string;
}): Promise<Result<SalaryAdvanceView>> {
	const advance = await getSalaryAdvanceRecord(advanceId);

	if (!advance) {
		return failure({
			type: "NotFoundError",
			message: "Salary advance not found.",
		});
	}

	if (advance.status !== SALARY_ADVANCE_STATUS.PENDING) {
		return failure({
			type: "ValidationError",
			message:
				"Only pending salary advances can be cancelled here. Disbursed or recovering advances require a manual reversal process.",
		});
	}

	try {
		const [updated] = await db
			.update(salaryAdvances)
			.set({
				cancelledAt: new Date(),
				cancelledBy,
				cancellationReason: cancellationReason.trim(),
				status: SALARY_ADVANCE_STATUS.CANCELLED,
			})
			.where(eq(salaryAdvances.id, advanceId))
			.returning();

		return success(parseSalaryAdvanceRecord(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to cancel salary advance.",
		});
	}
}

async function getActiveAdvancesForEmployee(
	employeeId: string
): Promise<Result<SalaryAdvanceView[]>> {
	const employeeResult = await getEligibleEmployee(employeeId);
	if (!employeeResult.success) return employeeResult;

	const currentPeriodStart = getCurrentPeriodStartDate();
	const currentMonth = currentPeriodStart.getMonth() + 1;
	const currentYear = currentPeriodStart.getFullYear();

	const rows = await db.query.salaryAdvances.findMany({
		where: and(
			eq(salaryAdvances.employeeId, employeeId),
			inArray(salaryAdvances.status, [
				SALARY_ADVANCE_STATUS.DISBURSED,
				SALARY_ADVANCE_STATUS.RECOVERING,
			]),
			or(
				lt(salaryAdvances.recoveryStartYear, currentYear),
				and(
					eq(salaryAdvances.recoveryStartYear, currentYear),
					lte(salaryAdvances.recoveryStartMonth, currentMonth)
				)
			)
		),
		orderBy: [asc(salaryAdvances.recoveryStartYear), asc(salaryAdvances.recoveryStartMonth)],
	});

	return success(rows.map(parseSalaryAdvanceRecord));
}

async function getTotalMonthlyAdvanceRecoveries(
	employeeId: string,
	periodMonth: number,
	periodYear: number
): Promise<Result<TotalMonthlyAdvanceRecoveriesResponse>> {
	const employeeResult = await getEligibleEmployee(employeeId);
	if (!employeeResult.success) return employeeResult;

	const rows = await db.query.salaryAdvances.findMany({
		where: and(
			eq(salaryAdvances.employeeId, employeeId),
			inArray(salaryAdvances.status, [
				SALARY_ADVANCE_STATUS.DISBURSED,
				SALARY_ADVANCE_STATUS.RECOVERING,
			]),
			or(
				lt(salaryAdvances.recoveryStartYear, periodYear),
				and(
					eq(salaryAdvances.recoveryStartYear, periodYear),
					lte(salaryAdvances.recoveryStartMonth, periodMonth)
				)
			)
		),
		orderBy: [asc(salaryAdvances.recoveryStartYear), asc(salaryAdvances.recoveryStartMonth)],
	});

	const items = rows
		.map(parseSalaryAdvanceRecord)
		.filter(
			(advance) => advance.monthlyRecoveryAmount !== null && advance.outstandingBalance !== null
		)
		.map((advance) => ({
			advanceId: advance.id,
			approvedRecoveryMonths: advance.approvedRecoveryMonths,
			monthlyRecoveryAmount: advance.monthlyRecoveryAmount ?? 0,
			outstandingBalance: advance.outstandingBalance ?? 0,
			recoveriesProcessed: advance.recoveriesProcessed,
		}));

	return success({
		employeeId,
		items,
		totalRecoveryAmount: roundDecimal(
			items.reduce((total, item) => total + item.monthlyRecoveryAmount, 0)
		),
	});
}

function isSalaryAdvanceRecoveryUniqueViolation(error: unknown) {
	return Boolean(
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "23505" &&
		"constraint" in error &&
		error.constraint === "uq_salary_advance_recoveries_advance_period"
	);
}

async function processPayrollAdvanceRecovery({
	advanceId,
	periodMonth,
	periodYear,
	payrollSlipId,
}: z.infer<typeof payrollAdvanceRecoverySchema>): Promise<Result<SalaryAdvanceRecoveryView>> {
	const advance = await getSalaryAdvanceRecord(advanceId);

	if (!advance) {
		return failure({
			type: "NotFoundError",
			message: "Salary advance not found.",
		});
	}

	if (
		advance.status !== SALARY_ADVANCE_STATUS.DISBURSED &&
		advance.status !== SALARY_ADVANCE_STATUS.RECOVERING
	) {
		return failure({
			type: "ValidationError",
			message: `Only disbursed or recovering advances can be processed. This advance is ${advance.status}.`,
		});
	}

	if (
		advance.recoveryStartMonth === null ||
		advance.recoveryStartYear === null ||
		advance.approvedRecoveryMonths === null ||
		advance.monthlyRecoveryAmount === null ||
		advance.outstandingBalance === null
	) {
		return failure({
			type: "ValidationError",
			message: "Salary advance is missing recovery configuration.",
		});
	}

	const targetPeriodStart = getPeriodStartDate(periodMonth, periodYear);
	const recoveryStartDate = getPeriodStartDate(
		advance.recoveryStartMonth,
		advance.recoveryStartYear
	);

	if (isBefore(targetPeriodStart, recoveryStartDate)) {
		return failure({
			type: "ValidationError",
			message: "Recovery period cannot be earlier than the configured recovery start period.",
		});
	}

	const existingRecovery = await db.query.salaryAdvanceRecoveries.findFirst({
		where: and(
			eq(salaryAdvanceRecoveries.advanceId, advanceId),
			eq(salaryAdvanceRecoveries.periodMonth, periodMonth),
			eq(salaryAdvanceRecoveries.periodYear, periodYear)
		),
	});

	if (existingRecovery) {
		return failure({
			type: "ConflictError",
			message: "A payroll recovery already exists for this salary advance and period.",
		});
	}

	const accountMappingsResult = await getAccountMappingsAsMapFn();

	if (!accountMappingsResult.success) {
		return accountMappingsResult;
	}

	const employeeResult = await getEligibleEmployee(advance.employeeId);

	if (!employeeResult.success) {
		return employeeResult;
	}

	const employee = employeeResult.data;

	const balanceBefore = roundDecimal(advance.outstandingBalance);
	const monthlyRecoveryAmount = roundDecimal(advance.monthlyRecoveryAmount);
	const { balanceAfter, isLastRecovery, recoveryAmount } = computeSalaryAdvanceRecoveryStep({
		approvedRecoveryMonths: advance.approvedRecoveryMonths,
		monthlyRecoveryAmount,
		outstandingBalance: balanceBefore,
		recoveriesProcessed: advance.recoveriesProcessed,
	});
	const recoveryDate = getTodayDateString();
	const employeeFullName = `${employee.firstName} ${employee.lastName}`.trim();
	const journalLines = [
		{
			accountId: accountMappingsResult.data.salary_advance_payable,
			amount: toDecimalString(recoveryAmount),
			dc: "debit" as const,
			lineNumber: 1,
			memo: `Salary advance recovery ${advanceId}`,
		},
		{
			accountId: accountMappingsResult.data.salary_advance_receivable,
			amount: toDecimalString(recoveryAmount),
			dc: "credit" as const,
			lineNumber: 2,
			memo: `Salary advance recovery ${advanceId}`,
		},
	];

	if (!areJournalValuesBalanced(journalLines)) {
		return failure({
			type: "ApplicationError",
			message: "Salary advance recovery journal is not balanced.",
		});
	}

	try {
		const recovery = await db.transaction(async (tx) => {
			const journalEntryId = await createJournalEntry({
				entry: {
					description: `Salary advance recovery - ${employeeFullName} - period ${periodMonth}/${periodYear}`,
					entryDate: recoveryDate,
					reference: `ADVANCE-${advanceId}`,
					source: "salary_advance_recovery",
					sourceId: advanceId.toString(),
				},
				lines: journalLines,
				tx,
			});

			const [created] = await tx
				.insert(salaryAdvanceRecoveries)
				.values({
					advanceId,
					balanceAfter: toDecimalString(balanceAfter),
					balanceBefore: toDecimalString(balanceBefore),
					clearingJournalEntryId: journalEntryId,
					employeeId: advance.employeeId,
					isLastRecovery,
					payrollSlipId,
					periodMonth,
					periodYear,
					recoveryAmount: toDecimalString(recoveryAmount),
					recoveryDate,
				})
				.returning();

			await tx
				.update(salaryAdvances)
				.set({
					outstandingBalance: toDecimalString(balanceAfter),
					recoveriesProcessed: advance.recoveriesProcessed + 1,
					status:
						balanceAfter <= 0
							? SALARY_ADVANCE_STATUS.FULLY_RECOVERED
							: SALARY_ADVANCE_STATUS.RECOVERING,
					totalRecovered: toDecimalString(roundDecimal(advance.totalRecovered) + recoveryAmount),
				})
				.where(eq(salaryAdvances.id, advanceId));

			return created;
		});

		return success(parseSalaryAdvanceRecoveryRecord(recovery));
	} catch (error) {
		if (isSalaryAdvanceRecoveryUniqueViolation(error)) {
			return failure({
				type: "ConflictError",
				message: "A payroll recovery already exists for this salary advance and period.",
			});
		}

		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to process salary advance recovery.",
		});
	}
}

async function getAdvanceById(advanceId: string): Promise<Result<SalaryAdvanceDetailView>> {
	const row = await db
		.select({
			applicationDate: salaryAdvances.applicationDate,
			approvedAmount: salaryAdvances.approvedAmount,
			approvedAt: salaryAdvances.approvedAt,
			approvedBy: salaryAdvances.approvedBy,
			approvedRecoveryMonths: salaryAdvances.approvedRecoveryMonths,
			cancellationReason: salaryAdvances.cancellationReason,
			cancelledAt: salaryAdvances.cancelledAt,
			cancelledBy: salaryAdvances.cancelledBy,
			createdAt: salaryAdvances.createdAt,
			departmentId: employees.departmentId,
			departmentName: departments.name,
			disbursementAccountId: salaryAdvances.disbursementAccountId,
			disbursementDate: salaryAdvances.disbursementDate,
			disbursementJournalEntryId: salaryAdvances.disbursementJournalEntryId,
			employeeId: salaryAdvances.employeeId,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			id: salaryAdvances.id,
			jobTitle: employees.jobTitle,
			monthlyRecoveryAmount: salaryAdvances.monthlyRecoveryAmount,
			notes: salaryAdvances.notes,
			outstandingBalance: salaryAdvances.outstandingBalance,
			reason: salaryAdvances.reason,
			recoveriesProcessed: salaryAdvances.recoveriesProcessed,
			recoveryStartMonth: salaryAdvances.recoveryStartMonth,
			recoveryStartYear: salaryAdvances.recoveryStartYear,
			rejectedAt: salaryAdvances.rejectedAt,
			rejectedBy: salaryAdvances.rejectedBy,
			rejectionReason: salaryAdvances.rejectionReason,
			requestedAmount: salaryAdvances.requestedAmount,
			requestedRecoveryMonths: salaryAdvances.requestedRecoveryMonths,
			status: salaryAdvances.status,
			totalRecovered: salaryAdvances.totalRecovered,
			updatedAt: salaryAdvances.updatedAt,
		})
		.from(salaryAdvances)
		.innerJoin(employees, eq(salaryAdvances.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(eq(salaryAdvances.id, advanceId))
		.then((rows) => rows[0] ?? null);

	if (!row) {
		return failure({
			type: "NotFoundError",
			message: "Salary advance not found.",
		});
	}

	const recoveries = await db.query.salaryAdvanceRecoveries.findMany({
		where: eq(salaryAdvanceRecoveries.advanceId, advanceId),
		orderBy: [asc(salaryAdvanceRecoveries.recoveryDate), asc(salaryAdvanceRecoveries.createdAt)],
	});

	const actorIds = [row.approvedBy, row.rejectedBy, row.cancelledBy].filter(
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
	const parsedAdvance = parseSalaryAdvanceRecord(row);

	return success({
		...parsedAdvance,
		departmentId: row.departmentId,
		departmentName: row.departmentName,
		employeeNo: row.employeeNo,
		fullName: row.fullName,
		jobTitle: row.jobTitle,
		approvedByName: row.approvedBy ? (actorNameById.get(row.approvedBy) ?? null) : null,
		cancelledByName: row.cancelledBy ? (actorNameById.get(row.cancelledBy) ?? null) : null,
		recoveries: recoveries.map(parseSalaryAdvanceRecoveryRecord),
		rejectedByName: row.rejectedBy ? (actorNameById.get(row.rejectedBy) ?? null) : null,
	});
}

async function getAdvancesByEmployee(
	employeeId: string,
	statusFilter?: SalaryAdvanceStatus | "all"
): Promise<Result<SalaryAdvanceView[]>> {
	const employeeResult = await getEligibleEmployee(employeeId);
	if (!employeeResult.success) return employeeResult;

	const rows = await db.query.salaryAdvances.findMany({
		where: and(
			eq(salaryAdvances.employeeId, employeeId),
			statusFilter && statusFilter !== "all" ? eq(salaryAdvances.status, statusFilter) : undefined
		),
		orderBy: [desc(salaryAdvances.applicationDate), desc(salaryAdvances.createdAt)],
	});

	return success(rows.map(parseSalaryAdvanceRecord));
}

async function getAllPendingAdvances(): Promise<Array<SalaryAdvanceListItem>> {
	const rows = await db
		.select({
			applicationDate: salaryAdvances.applicationDate,
			approvedAmount: salaryAdvances.approvedAmount,
			approvedAt: salaryAdvances.approvedAt,
			approvedBy: salaryAdvances.approvedBy,
			approvedRecoveryMonths: salaryAdvances.approvedRecoveryMonths,
			cancellationReason: salaryAdvances.cancellationReason,
			cancelledAt: salaryAdvances.cancelledAt,
			cancelledBy: salaryAdvances.cancelledBy,
			createdAt: salaryAdvances.createdAt,
			departmentId: employees.departmentId,
			departmentName: departments.name,
			disbursementAccountId: salaryAdvances.disbursementAccountId,
			disbursementDate: salaryAdvances.disbursementDate,
			disbursementJournalEntryId: salaryAdvances.disbursementJournalEntryId,
			employeeId: salaryAdvances.employeeId,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			id: salaryAdvances.id,
			jobTitle: employees.jobTitle,
			monthlyRecoveryAmount: salaryAdvances.monthlyRecoveryAmount,
			notes: salaryAdvances.notes,
			outstandingBalance: salaryAdvances.outstandingBalance,
			reason: salaryAdvances.reason,
			recoveriesProcessed: salaryAdvances.recoveriesProcessed,
			recoveryStartMonth: salaryAdvances.recoveryStartMonth,
			recoveryStartYear: salaryAdvances.recoveryStartYear,
			rejectedAt: salaryAdvances.rejectedAt,
			rejectedBy: salaryAdvances.rejectedBy,
			rejectionReason: salaryAdvances.rejectionReason,
			requestedAmount: salaryAdvances.requestedAmount,
			requestedRecoveryMonths: salaryAdvances.requestedRecoveryMonths,
			status: salaryAdvances.status,
			totalRecovered: salaryAdvances.totalRecovered,
			updatedAt: salaryAdvances.updatedAt,
		})
		.from(salaryAdvances)
		.innerJoin(employees, eq(salaryAdvances.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(
			and(eq(salaryAdvances.status, SALARY_ADVANCE_STATUS.PENDING), isNull(employees.deletedAt))
		)
		.orderBy(desc(salaryAdvances.applicationDate), desc(salaryAdvances.createdAt));

	return rows.map((row) => ({
		...parseSalaryAdvanceRecord(row),
		departmentId: row.departmentId,
		departmentName: row.departmentName,
		employeeNo: row.employeeNo,
		fullName: row.fullName,
		jobTitle: row.jobTitle,
	}));
}

function buildActiveAdvanceListConditions(filters: ActiveSalaryAdvanceFilters) {
	const conditions: Array<SQL | undefined> = [
		isNull(employees.deletedAt),
		inArray(salaryAdvances.status, [
			SALARY_ADVANCE_STATUS.DISBURSED,
			SALARY_ADVANCE_STATUS.RECOVERING,
		]),
	];

	if (filters.departmentId) {
		conditions.push(eq(employees.departmentId, filters.departmentId));
	}

	if (filters.employeeId) {
		conditions.push(eq(salaryAdvances.employeeId, filters.employeeId));
	}

	return conditions;
}

async function getAllActiveAdvances(
	filters: ActiveSalaryAdvanceFilters
): Promise<Array<SalaryAdvanceListItem>> {
	const rows = await db
		.select({
			applicationDate: salaryAdvances.applicationDate,
			approvedAmount: salaryAdvances.approvedAmount,
			approvedAt: salaryAdvances.approvedAt,
			approvedBy: salaryAdvances.approvedBy,
			approvedRecoveryMonths: salaryAdvances.approvedRecoveryMonths,
			cancellationReason: salaryAdvances.cancellationReason,
			cancelledAt: salaryAdvances.cancelledAt,
			cancelledBy: salaryAdvances.cancelledBy,
			createdAt: salaryAdvances.createdAt,
			departmentId: employees.departmentId,
			departmentName: departments.name,
			disbursementAccountId: salaryAdvances.disbursementAccountId,
			disbursementDate: salaryAdvances.disbursementDate,
			disbursementJournalEntryId: salaryAdvances.disbursementJournalEntryId,
			employeeId: salaryAdvances.employeeId,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			id: salaryAdvances.id,
			jobTitle: employees.jobTitle,
			monthlyRecoveryAmount: salaryAdvances.monthlyRecoveryAmount,
			notes: salaryAdvances.notes,
			outstandingBalance: salaryAdvances.outstandingBalance,
			reason: salaryAdvances.reason,
			recoveriesProcessed: salaryAdvances.recoveriesProcessed,
			recoveryStartMonth: salaryAdvances.recoveryStartMonth,
			recoveryStartYear: salaryAdvances.recoveryStartYear,
			rejectedAt: salaryAdvances.rejectedAt,
			rejectedBy: salaryAdvances.rejectedBy,
			rejectionReason: salaryAdvances.rejectionReason,
			requestedAmount: salaryAdvances.requestedAmount,
			requestedRecoveryMonths: salaryAdvances.requestedRecoveryMonths,
			status: salaryAdvances.status,
			totalRecovered: salaryAdvances.totalRecovered,
			updatedAt: salaryAdvances.updatedAt,
		})
		.from(salaryAdvances)
		.innerJoin(employees, eq(salaryAdvances.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(and(...buildActiveAdvanceListConditions(filters)))
		.orderBy(desc(salaryAdvances.applicationDate), desc(salaryAdvances.createdAt));

	return rows.map((row) => ({
		...parseSalaryAdvanceRecord(row),
		departmentId: row.departmentId,
		departmentName: row.departmentName,
		employeeNo: row.employeeNo,
		fullName: row.fullName,
		jobTitle: row.jobTitle,
	}));
}

async function getAdvanceRecoveryStatement(
	advanceId: string
): Promise<Result<SalaryAdvanceStatementView>> {
	const advance = await getSalaryAdvanceRecord(advanceId);

	if (!advance) {
		return failure({
			type: "NotFoundError",
			message: "Salary advance not found.",
		});
	}

	const recoveries = await db.query.salaryAdvanceRecoveries.findMany({
		where: eq(salaryAdvanceRecoveries.advanceId, advanceId),
		orderBy: [asc(salaryAdvanceRecoveries.recoveryDate), asc(salaryAdvanceRecoveries.createdAt)],
	});

	return success({
		advanceId,
		closingOutstandingBalance: roundDecimal(advance.outstandingBalance ?? 0),
		entries: recoveries.map((recovery) => ({
			amount: roundDecimal(recovery.recoveryAmount),
			balanceAfter: roundDecimal(recovery.balanceAfter),
			balanceBefore: roundDecimal(recovery.balanceBefore),
			date: recovery.recoveryDate,
			isLastRecovery: recovery.isLastRecovery,
		})),
		openingBalance: roundDecimal(advance.approvedAmount ?? advance.requestedAmount),
	});
}

async function requireSalaryAdvanceViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-advances:view");
}

async function requireSalaryAdvanceCreateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-advances:create");
}

async function requireSalaryAdvanceApproveAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-advances:approve");
}

async function requireSalaryAdvanceCancelAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-advances:approve");
}

export const getSalaryAdvanceFormOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireSalaryAdvanceViewAccess();
		return getSalaryAdvanceFormOptions();
	});

export const getAllPendingAdvancesFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireSalaryAdvanceViewAccess();
		return getAllPendingAdvances();
	});

export const getAllActiveAdvancesFn = createServerFn()
	.middleware([authMiddleware])
	.validator(allActiveSalaryAdvancesFilterSchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		return getAllActiveAdvances(data);
	});

export const getAdvanceByIdFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryAdvanceByIdSchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		return ensureResult(await getAdvanceById(data.advanceId));
	});

export const getAdvancesByEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryAdvancesByEmployeeSchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		return ensureResult(await getAdvancesByEmployee(data.employeeId, data.statusFilter));
	});

export const getAdvanceRecoveryStatementFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryAdvanceByIdSchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		return ensureResult(await getAdvanceRecoveryStatement(data.advanceId));
	});

export const getActiveAdvancesForEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(activeSalaryAdvancesForEmployeeSchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		return ensureResult(await getActiveAdvancesForEmployee(data.employeeId));
	});

export const getTotalMonthlyAdvanceRecoveriesFn = createServerFn()
	.middleware([authMiddleware])
	.validator(totalMonthlyAdvanceRecoveriesSchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		return ensureResult(
			await getTotalMonthlyAdvanceRecoveries(data.employeeId, data.periodMonth, data.periodYear)
		);
	});

export const applyForSalaryAdvanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(applyForSalaryAdvanceSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryAdvanceCreateAccess();
		return applyForSalaryAdvance({
			payload: data,
			createdBy: context.user.id,
		});
	});

export const approveSalaryAdvanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(approveSalaryAdvanceSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryAdvanceApproveAccess();
		const result = await approveSalaryAdvance({
			advanceId: data.advanceId,
			payload: data.payload,
			approverId: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "approve salary advance",
					description: `Approved salary advance ${data.advanceId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const rejectSalaryAdvanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(rejectSalaryAdvanceSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryAdvanceApproveAccess();
		const result = await rejectSalaryAdvance({
			advanceId: data.advanceId,
			rejectedBy: context.user.id,
			rejectionReason: data.rejectionReason,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "reject salary advance",
					description: `Rejected salary advance ${data.advanceId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const cancelSalaryAdvanceFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(cancelSalaryAdvanceSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryAdvanceCancelAccess();
		const result = await cancelSalaryAdvance({
			advanceId: data.advanceId,
			cancelledBy: context.user.id,
			cancellationReason: data.cancellationReason,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "cancel salary advance",
					description: `Cancelled salary advance ${data.advanceId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const processPayrollAdvanceRecoveryFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollAdvanceRecoverySchema)
	.handler(async ({ data }) => {
		await requireSalaryAdvanceViewAccess();
		await requirePermission("payroll-process:create");
		return processPayrollAdvanceRecovery(data);
	});

export type SalaryAdvanceFormOptionsResponse = Awaited<
	ReturnType<typeof getSalaryAdvanceFormOptionsFn>
>;
export type SalaryAdvancePendingListItem = Awaited<
	ReturnType<typeof getAllPendingAdvancesFn>
>[number];
export type SalaryAdvanceActiveListItem = Awaited<
	ReturnType<typeof getAllActiveAdvancesFn>
>[number];
export type SalaryAdvanceDetailResponse = Awaited<ReturnType<typeof getAdvanceByIdFn>>;
export type SalaryAdvanceStatementResponse = Awaited<
	ReturnType<typeof getAdvanceRecoveryStatementFn>
>;
