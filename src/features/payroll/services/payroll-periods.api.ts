import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	lte,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
	employeeLoans,
	employees,
	leaveRequests,
	overtimeRecords,
	payrollPeriods,
	salaryStructures,
} from "@/drizzle/schema";
import {
	getDaysUntilPayrollRemittanceDeadline,
	getPayrollPayDateWindow,
	getPayrollPeriodEnd,
	getPayrollPeriodName,
	getPayrollPeriodRemittanceDeadline,
	getPayrollPeriodStart,
	getPreviousPayrollPeriod,
	isPayrollPayDateAllowed,
	isPayrollPayDateSunday,
	isValidPayrollPeriodParts,
} from "@/features/payroll/lib/payroll-period-helpers";
import { resolveStatutoryRates } from "@/features/payroll/lib/payroll-rate-resolver";
import {
	LOAN_STATUS,
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	PAYROLL_PERIOD_STATUS,
	PAYROLL_STATUS_TRANSITIONS,
	type PayrollAccountRole,
	type PayrollPeriodStatus,
} from "@/features/payroll/lib/payroll-constants";
import {
	normalizePayrollText,
	roundPayrollAmount,
	toPayrollDecimalString,
} from "@/features/payroll/lib/helpers";
import {
	payrollPeriodCreateSchema,
	payrollPeriodFiltersSchema,
	payrollPeriodIdSchema,
	payrollPeriodMonthYearSchema,
	payrollPeriodTransitionSchema,
	payrollPeriodYearSchema,
} from "@/features/payroll/services/payroll-period.schemas";
import { dateFormat } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type PayrollPeriodRecord = typeof payrollPeriods.$inferSelect;
type PayrollPeriodCreatePayload = z.infer<typeof payrollPeriodCreateSchema>;
type PayrollPeriodTransitionPayload = z.infer<typeof payrollPeriodTransitionSchema>;
type PayrollPeriodFilters = z.infer<typeof payrollPeriodFiltersSchema>;
type PayrollPeriodCreateResponse = {
	period: PayrollPeriodView;
	warnings: string[];
};
type PayrollPeriodPreflightSummary = {
	activeEmployeeCount: number;
	employeesWithNoSalaryStructure: Array<{
		employeeId: string;
		employeeName: string;
	}>;
	employeesWithPendingLeave: Array<{
		employeeId: string;
		employeeName: string;
		pendingDays: number;
	}>;
	approvedOvertimeRecordCount: number;
	activeLoansCount: number;
	accountMappingsComplete: boolean;
	missingAccountMappings: string[];
	previousPeriodStatus: string | null;
	statutoryRatesSource: Record<string, "database" | "constant">;
};
export type PayrollPeriodPreflightReport = {
	canProceed: boolean;
	errors: string[];
	warnings: string[];
	summary: PayrollPeriodPreflightSummary;
};
export type PayrollPeriodView = {
	id: string;
	name: string;
	periodMonth: number;
	periodYear: number;
	periodStart: string;
	periodEnd: string;
	payDate: string;
	status: PayrollPeriodStatus;
	totalGrossPay: number | null;
	totalNetPay: number | null;
	totalPaye: number | null;
	totalNssfEmployee: number | null;
	totalNssfEmployer: number | null;
	totalShifEmployee: number | null;
	totalShifEmployer: number | null;
	totalAhlEmployee: number | null;
	totalAhlEmployer: number | null;
	totalNita: number | null;
	totalLoanDeductions: number | null;
	totalAdvanceRecoveries: number | null;
	totalOtherDeductions: number | null;
	totalPensionEmployer: number | null;
	employeeCount: number | null;
	processingStartedAt: Date | null;
	processingCompletedAt: Date | null;
	approvedBy: string | null;
	approvedAt: Date | null;
	paidAt: Date | null;
	closedAt: Date | null;
	cancelledBy: string | null;
	cancelledAt: Date | null;
	cancellationReason: string | null;
	disbursementJournalEntryId: number | null;
	remittanceJournalEntryId: number | null;
	payrollJournalEntryId: number | null;
	notes: string | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
	statutoryRemittanceDeadline: string;
	daysUntilRemittanceDeadline: number;
	allowedTransitions: PayrollPeriodStatus[];
};
export type PayrollPeriodRemittanceStatus = {
	periodName: string;
	payDate: string;
	remittanceDeadline: string;
	daysUntilDeadline: number;
	isOverdue: boolean;
	items: Array<{
		name: "PAYE" | "NSSF" | "SHIF" | "AHL" | "NITA" | "HELB";
		amount: number;
		journalPosted: boolean;
		dueDate: string;
	}>;
};
export type PayrollPeriodYearToDateTotals = {
	year: number;
	totalGrossPay: number;
	totalNetPay: number;
	totalPaye: number;
	totalNssfEmployee: number;
	totalNssfEmployer: number;
	totalNssfCombined: number;
	totalShifEmployee: number;
	totalShifEmployer: number;
	totalShifCombined: number;
	totalAhlEmployee: number;
	totalAhlEmployer: number;
	totalAhlCombined: number;
	totalNita: number;
	totalLoanDeductions: number;
	totalAdvanceRecoveries: number;
	totalPensionEmployer: number;
	totalEmployeeCount: number;
	periodCount: number;
};

const PERIOD_NUMERIC_FIELDS = [
	"totalGrossPay",
	"totalNetPay",
	"totalPaye",
	"totalNssfEmployee",
	"totalNssfEmployer",
	"totalShifEmployee",
	"totalShifEmployer",
	"totalAhlEmployee",
	"totalAhlEmployer",
	"totalNita",
	"totalLoanDeductions",
	"totalAdvanceRecoveries",
	"totalOtherDeductions",
	"totalPensionEmployer",
] as const satisfies ReadonlyArray<keyof PayrollPeriodRecord>;

function toNumber(value: string | number | null | undefined) {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const parsed = Number.parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : null;
}

function sumNumbers(values: Array<number | null | undefined>) {
	return roundPayrollAmount(values.reduce<number>((total, value) => total + (value ?? 0), 0));
}

function toPayrollPeriodView(row: PayrollPeriodRecord): PayrollPeriodView {
	const statutoryRemittanceDeadline = getPayrollPeriodRemittanceDeadline(
		row.periodMonth,
		row.periodYear
	);

	return {
		id: row.id,
		name: row.name,
		periodMonth: row.periodMonth,
		periodYear: row.periodYear,
		periodStart: row.periodStart,
		periodEnd: row.periodEnd,
		payDate: row.payDate,
		status: row.status,
		totalGrossPay: toNumber(row.totalGrossPay),
		totalNetPay: toNumber(row.totalNetPay),
		totalPaye: toNumber(row.totalPaye),
		totalNssfEmployee: toNumber(row.totalNssfEmployee),
		totalNssfEmployer: toNumber(row.totalNssfEmployer),
		totalShifEmployee: toNumber(row.totalShifEmployee),
		totalShifEmployer: toNumber(row.totalShifEmployer),
		totalAhlEmployee: toNumber(row.totalAhlEmployee),
		totalAhlEmployer: toNumber(row.totalAhlEmployer),
		totalNita: toNumber(row.totalNita),
		totalLoanDeductions: toNumber(row.totalLoanDeductions),
		totalAdvanceRecoveries: toNumber(row.totalAdvanceRecoveries),
		totalOtherDeductions: toNumber(row.totalOtherDeductions),
		totalPensionEmployer: toNumber(row.totalPensionEmployer),
		employeeCount: row.employeeCount,
		processingStartedAt: row.processingStartedAt,
		processingCompletedAt: row.processingCompletedAt,
		approvedBy: row.approvedBy,
		approvedAt: row.approvedAt,
		paidAt: row.paidAt,
		closedAt: row.closedAt,
		cancelledBy: row.cancelledBy,
		cancelledAt: row.cancelledAt,
		cancellationReason: row.cancellationReason,
		disbursementJournalEntryId: row.disbursementJournalEntryId,
		remittanceJournalEntryId: row.remittanceJournalEntryId,
		payrollJournalEntryId: row.payrollJournalEntryId,
		notes: row.notes,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		statutoryRemittanceDeadline,
		daysUntilRemittanceDeadline:
			getDaysUntilPayrollRemittanceDeadline(statutoryRemittanceDeadline),
		allowedTransitions: PAYROLL_STATUS_TRANSITIONS[row.status],
	};
}

function toPeriodInsertValues(payload: PayrollPeriodCreatePayload, createdBy: string) {
	return {
		name: getPayrollPeriodName(payload.periodMonth, payload.periodYear),
		periodMonth: payload.periodMonth,
		periodYear: payload.periodYear,
		periodStart: getPayrollPeriodStart(payload.periodMonth, payload.periodYear),
		periodEnd: getPayrollPeriodEnd(payload.periodMonth, payload.periodYear),
		payDate: payload.payDate,
		status: PAYROLL_PERIOD_STATUS.DRAFT,
		createdBy,
	};
}

function getPeriodTotalValue(row: PayrollPeriodRecord, key: (typeof PERIOD_NUMERIC_FIELDS)[number]) {
	return toNumber(row[key]);
}

async function getPayrollPeriodRecordById(periodId: string) {
	return db.query.payrollPeriods.findFirst({
		where: eq(payrollPeriods.id, periodId),
	});
}

async function getActiveEmployeeDirectory() {
	return db
		.select({
			id: employees.id,
			employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
		})
		.from(employees)
		.where(and(eq(employees.status, "active"), isNull(employees.deletedAt)))
		.orderBy(asc(employees.firstName), asc(employees.lastName));
}

async function getActiveStructuresByEmployeeId(employeeIds: string[], periodDate: string) {
	if (!employeeIds.length) {
		return {};
	}

	const rows = await db.query.salaryStructures.findMany({
		where: and(
			inArray(salaryStructures.employeeId, employeeIds),
			lte(salaryStructures.effectiveFrom, periodDate),
			or(isNull(salaryStructures.effectiveTo), gte(salaryStructures.effectiveTo, periodDate))
		),
		orderBy: [
			asc(salaryStructures.employeeId),
			desc(salaryStructures.effectiveFrom),
			desc(salaryStructures.id),
		],
	});

	const map: Record<string, (typeof rows)[number]> = {};

	for (const row of rows) {
		if (!map[row.employeeId]) {
			map[row.employeeId] = row;
		}
	}

	return map;
}

async function getAccountMappingDiagnostics() {
	const mappings = await db.query.payrollAccountMappings.findMany({
		columns: {
			role: true,
			accountId: true,
		},
		with: {
			account: {
				columns: {
					id: true,
					type: true,
					isActive: true,
				},
			},
		},
	});
	const mappingByRole = new Map(mappings.map((mapping) => [mapping.role, mapping]));
	const missingRoles = PAYROLL_ACCOUNT_ROLE_KEYS.filter((role) => !mappingByRole.has(role));
	const invalidRoles = PAYROLL_ACCOUNT_ROLE_KEYS.filter((role) => {
		const mapping = mappingByRole.get(role);

		if (!mapping || !mapping.account) {
			return false;
		}

		return (
			mapping.account.isActive !== true ||
			mapping.account.type !== PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES[role]
		);
	});

	return {
		accountMappingsComplete: missingRoles.length === 0 && invalidRoles.length === 0,
		missingAccountMappings: [...missingRoles, ...invalidRoles] as PayrollAccountRole[],
	};
}

async function getPendingLeaveSummary(periodStart: string, periodEnd: string) {
	const rows = await db
		.select({
			employeeId: employees.id,
			employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			pendingDays: leaveRequests.workingDaysRequested,
		})
		.from(leaveRequests)
		.innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
		.where(
			and(
				eq(leaveRequests.status, "pending"),
				lte(leaveRequests.startDate, periodEnd),
				gte(leaveRequests.endDate, periodStart),
				isNull(employees.deletedAt)
			)
		);

	const grouped = new Map<
		string,
		{
			employeeId: string;
			employeeName: string;
			pendingDays: number;
		}
	>();

	for (const row of rows) {
		const existing = grouped.get(row.employeeId);
		const pendingDays = toNumber(row.pendingDays) ?? 0;

		if (existing) {
			existing.pendingDays = roundPayrollAmount(existing.pendingDays + pendingDays);
			continue;
		}

		grouped.set(row.employeeId, {
			employeeId: row.employeeId,
			employeeName: row.employeeName,
			pendingDays: roundPayrollAmount(pendingDays),
		});
	}

	return Array.from(grouped.values());
}

async function getPreviousPeriodStatus(periodMonth: number, periodYear: number) {
	const previous = getPreviousPayrollPeriod(periodMonth, periodYear);
	const row = await db.query.payrollPeriods.findFirst({
		columns: {
			status: true,
			name: true,
		},
		where: and(
			eq(payrollPeriods.periodMonth, previous.periodMonth),
			eq(payrollPeriods.periodYear, previous.periodYear)
		),
		orderBy: [desc(payrollPeriods.updatedAt)],
	});

	return row;
}

async function getHelbTotalForPeriod(periodDate: string) {
	const activeEmployees = await getActiveEmployeeDirectory();
	const structuresByEmployeeId = await getActiveStructuresByEmployeeId(
		activeEmployees.map((employee) => employee.id),
		periodDate
	);

	return sumNumbers(
		Object.values(structuresByEmployeeId).map((structure) =>
			structure.hasHelbLoan ? toNumber(structure.helbMonthlyDeduction) : 0
		)
	);
}

async function createPayrollPeriod({
	payload,
	createdBy,
}: {
	payload: PayrollPeriodCreatePayload;
	createdBy: string;
}): Promise<Result<PayrollPeriodCreateResponse>> {
	if (!isValidPayrollPeriodParts(payload.periodMonth, payload.periodYear)) {
		return failure({
			type: "ValidationError",
			message: "Payroll month must be between 1 and 12 and payroll year must be between 2020 and 2100.",
		});
	}

	const existingPeriods = await db.query.payrollPeriods.findMany({
		where: and(
			eq(payrollPeriods.periodMonth, payload.periodMonth),
			eq(payrollPeriods.periodYear, payload.periodYear)
		),
		orderBy: [desc(payrollPeriods.updatedAt)],
	});
	const existingActivePeriod = existingPeriods.find(
		(period) => period.status !== PAYROLL_PERIOD_STATUS.CANCELLED
	);

	if (existingActivePeriod) {
		return failure({
			type: "ConflictError",
			message: `Payroll period ${existingActivePeriod.name} already exists in ${existingActivePeriod.status} status.`,
		});
	}

	if (!isPayrollPayDateAllowed(payload.payDate, payload.periodMonth, payload.periodYear)) {
		const allowedWindow = getPayrollPayDateWindow(payload.periodMonth, payload.periodYear);

		return failure({
			type: "ValidationError",
			message: `Pay date must fall within the payroll month or within the first 5 days of the following month. Allowed window is ${allowedWindow.start} to ${allowedWindow.end}.`,
		});
	}

	if (isPayrollPayDateSunday(payload.payDate)) {
		return failure({
			type: "ValidationError",
			message: "Pay date cannot fall on a Sunday. Use the nearest working day instead.",
		});
	}

	const warnings: string[] = [];
	const previousPeriod = await getPreviousPeriodStatus(payload.periodMonth, payload.periodYear);

	if (
		previousPeriod &&
		previousPeriod.status !== PAYROLL_PERIOD_STATUS.CLOSED &&
		previousPeriod.status !== PAYROLL_PERIOD_STATUS.CANCELLED
	) {
		warnings.push(
			`The previous period (${previousPeriod.name}) is still in ${previousPeriod.status} status. Consider closing it before processing this period.`
		);
	}

	try {
		const [created] = await db
			.insert(payrollPeriods)
			.values(toPeriodInsertValues(payload, createdBy))
			.returning();

		return success({
			period: toPayrollPeriodView(created),
			warnings,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create payroll period",
		});
	}
}

async function transitionPayrollPeriod({
	periodId,
	targetStatus,
	cancellationReason,
	performedBy,
}: PayrollPeriodTransitionPayload & {
	performedBy: string;
}): Promise<Result<PayrollPeriodView>> {
	const period = await getPayrollPeriodRecordById(periodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found",
		});
	}

	const allowedTransitions = PAYROLL_STATUS_TRANSITIONS[period.status];

	if (!allowedTransitions.includes(targetStatus)) {
		return failure({
			type: "ValidationError",
			message: `Payroll period is currently ${period.status}. Allowed transitions: ${allowedTransitions.join(", ") || "none"}.`,
		});
	}

	if (targetStatus === PAYROLL_PERIOD_STATUS.PROCESSING) {
		const preflight = await runPayrollPeriodPreflight(period.id);

		if (!preflight.canProceed) {
			return failure({
				type: "ValidationError",
				message: preflight.errors.join(" "),
			});
		}
	}

	if (targetStatus === PAYROLL_PERIOD_STATUS.APPROVED) {
		if (!period.processingCompletedAt) {
			return failure({
				type: "ValidationError",
				message: "Payroll period processing must complete before approval.",
			});
		}

		// TODO: validate payroll_slips error states when payroll calculation engine is implemented
		if ((period.employeeCount ?? 0) <= 0) {
			return failure({
				type: "ValidationError",
				message: "Payroll period cannot be approved without processed employees.",
			});
		}
	}

	if (targetStatus === PAYROLL_PERIOD_STATUS.PAID) {
		const today = dateFormat(new Date());

		if (period.payDate > today) {
			return failure({
				type: "ValidationError",
				message: "Payroll period cannot be marked as paid before the configured pay date.",
			});
		}
	}

	if (targetStatus === PAYROLL_PERIOD_STATUS.CLOSED) {
		const pendingJournals = [
			period.payrollJournalEntryId ? null : "payroll journal",
			period.disbursementJournalEntryId ? null : "disbursement journal",
			period.remittanceJournalEntryId ? null : "remittance journal",
		].filter((value): value is string => value !== null);

		if (pendingJournals.length > 0) {
			return failure({
				type: "ValidationError",
				message: `Payroll period cannot be closed until these journals are posted: ${pendingJournals.join(", ")}.`,
			});
		}
	}

	if (
		targetStatus === PAYROLL_PERIOD_STATUS.CANCELLED &&
		(!cancellationReason || cancellationReason.trim() === "")
	) {
		return failure({
			type: "ValidationError",
			message: "Cancellation reason is required.",
		});
	}

	try {
		const updated = await db.transaction(async (tx) => {
			const timestamp = new Date();
			const updateValues: Partial<typeof payrollPeriods.$inferInsert> = {
				status: targetStatus,
				updatedAt: timestamp,
			};

			if (targetStatus === PAYROLL_PERIOD_STATUS.PROCESSING) {
				updateValues.processingStartedAt = timestamp;
			}

			if (targetStatus === PAYROLL_PERIOD_STATUS.APPROVED) {
				updateValues.approvedBy = performedBy;
				updateValues.approvedAt = timestamp;
			}

			if (targetStatus === PAYROLL_PERIOD_STATUS.PAID) {
				updateValues.paidAt = timestamp;
			}

			if (targetStatus === PAYROLL_PERIOD_STATUS.CLOSED) {
				updateValues.closedAt = timestamp;
			}

			if (targetStatus === PAYROLL_PERIOD_STATUS.CANCELLED) {
				updateValues.cancelledBy = performedBy;
				updateValues.cancelledAt = timestamp;
				updateValues.cancellationReason = normalizePayrollText(cancellationReason);

				// TODO: void associated payroll_slips when payroll calculation engine is implemented
			}

			const [row] = await tx
				.update(payrollPeriods)
				.set(updateValues)
				.where(eq(payrollPeriods.id, periodId))
				.returning();

			return row;
		});

		return success(toPayrollPeriodView(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to transition payroll period",
		});
	}
}

async function updatePeriodTotals(periodId: string): Promise<Result<PayrollPeriodView>> {
	const period = await getPayrollPeriodRecordById(periodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found",
		});
	}

	// TODO: aggregate non-cancelled payroll_slips for this period when the payroll calculation engine is implemented
	// TODO: aggregate salary advance recovery deductions from payroll_slips when the payroll calculation engine is implemented
	// TODO: aggregate employer pension contributions from payroll_slips when the payroll calculation engine is implemented
	const aggregatedTotals = {
		totalGrossPay: 0,
		totalNetPay: 0,
		totalPaye: 0,
		totalNssfEmployee: 0,
		totalNssfEmployer: 0,
		totalShifEmployee: 0,
		totalShifEmployer: 0,
		totalAhlEmployee: 0,
		totalAhlEmployer: 0,
		totalNita: 0,
		totalLoanDeductions: 0,
		totalAdvanceRecoveries: 0,
		totalOtherDeductions: 0,
		totalPensionEmployer: 0,
		employeeCount: 0,
	};

	try {
		const [updated] = await db
			.update(payrollPeriods)
			.set({
				totalGrossPay: toPayrollDecimalString(aggregatedTotals.totalGrossPay),
				totalNetPay: toPayrollDecimalString(aggregatedTotals.totalNetPay),
				totalPaye: toPayrollDecimalString(aggregatedTotals.totalPaye),
				totalNssfEmployee: toPayrollDecimalString(aggregatedTotals.totalNssfEmployee),
				totalNssfEmployer: toPayrollDecimalString(aggregatedTotals.totalNssfEmployer),
				totalShifEmployee: toPayrollDecimalString(aggregatedTotals.totalShifEmployee),
				totalShifEmployer: toPayrollDecimalString(aggregatedTotals.totalShifEmployer),
				totalAhlEmployee: toPayrollDecimalString(aggregatedTotals.totalAhlEmployee),
				totalAhlEmployer: toPayrollDecimalString(aggregatedTotals.totalAhlEmployer),
				totalNita: toPayrollDecimalString(aggregatedTotals.totalNita),
				totalLoanDeductions: toPayrollDecimalString(aggregatedTotals.totalLoanDeductions),
				totalAdvanceRecoveries: toPayrollDecimalString(
					aggregatedTotals.totalAdvanceRecoveries
				),
				totalOtherDeductions: toPayrollDecimalString(aggregatedTotals.totalOtherDeductions),
				totalPensionEmployer: toPayrollDecimalString(
					aggregatedTotals.totalPensionEmployer
				),
				employeeCount: aggregatedTotals.employeeCount,
				processingCompletedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(payrollPeriods.id, periodId))
			.returning();

		return success(toPayrollPeriodView(updated));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update payroll period totals",
		});
	}
}

async function getPayrollPeriodById(periodId: string) {
	const row = await getPayrollPeriodRecordById(periodId);
	return row ? toPayrollPeriodView(row) : null;
}

async function getAllPayrollPeriods(filters?: PayrollPeriodFilters) {
	const conditions: Array<SQL | undefined> = [];

	if (filters?.status) {
		conditions.push(eq(payrollPeriods.status, filters.status));
	}

	if (filters?.year) {
		conditions.push(eq(payrollPeriods.periodYear, filters.year));
	}

	const rows = await db.query.payrollPeriods.findMany({
		where: conditions.length > 0 ? and(...conditions) : undefined,
		orderBy: [desc(payrollPeriods.periodYear), desc(payrollPeriods.periodMonth)],
	});

	return rows.map(toPayrollPeriodView);
}

async function getActivePayrollPeriod() {
	const row = await db.query.payrollPeriods.findFirst({
		where: and(
			sql`${payrollPeriods.status} <> ${PAYROLL_PERIOD_STATUS.CLOSED}`,
			sql`${payrollPeriods.status} <> ${PAYROLL_PERIOD_STATUS.CANCELLED}`
		),
		orderBy: [desc(payrollPeriods.periodYear), desc(payrollPeriods.periodMonth)],
	});

	return row ? toPayrollPeriodView(row) : null;
}

async function getPayrollPeriodByMonthYear(periodMonth: number, periodYear: number) {
	const row = await db.query.payrollPeriods.findFirst({
		where: and(
			eq(payrollPeriods.periodMonth, periodMonth),
			eq(payrollPeriods.periodYear, periodYear)
		),
		orderBy: [desc(payrollPeriods.updatedAt)],
	});

	return row ? toPayrollPeriodView(row) : null;
}

async function getPeriodRemittanceStatus(periodId: string): Promise<PayrollPeriodRemittanceStatus | null> {
	const period = await getPayrollPeriodRecordById(periodId);

	if (!period) {
		return null;
	}

	const remittanceDeadline = getPayrollPeriodRemittanceDeadline(
		period.periodMonth,
		period.periodYear
	);
	const daysUntilDeadline = getDaysUntilPayrollRemittanceDeadline(remittanceDeadline);
	const journalPosted = period.remittanceJournalEntryId !== null;
	const helbAmount = await getHelbTotalForPeriod(period.periodEnd);

	return {
		periodName: period.name,
		payDate: period.payDate,
		remittanceDeadline,
		daysUntilDeadline,
		isOverdue: daysUntilDeadline < 0 && !journalPosted,
		items: [
			{
				name: "PAYE",
				amount: toNumber(period.totalPaye) ?? 0,
				journalPosted,
				dueDate: remittanceDeadline,
			},
			{
				name: "NSSF",
				amount: sumNumbers([
					toNumber(period.totalNssfEmployee),
					toNumber(period.totalNssfEmployer),
				]),
				journalPosted,
				dueDate: remittanceDeadline,
			},
			{
				name: "SHIF",
				amount: sumNumbers([
					toNumber(period.totalShifEmployee),
					toNumber(period.totalShifEmployer),
				]),
				journalPosted,
				dueDate: remittanceDeadline,
			},
			{
				name: "AHL",
				amount: sumNumbers([
					toNumber(period.totalAhlEmployee),
					toNumber(period.totalAhlEmployer),
				]),
				journalPosted,
				dueDate: remittanceDeadline,
			},
			{
				name: "NITA",
				amount: toNumber(period.totalNita) ?? 0,
				journalPosted,
				dueDate: remittanceDeadline,
			},
			{
				name: "HELB",
				amount: helbAmount,
				journalPosted,
				dueDate: remittanceDeadline,
			},
		],
	};
}

async function getYearToDateTotals(year: number): Promise<PayrollPeriodYearToDateTotals> {
	const rows = await db.query.payrollPeriods.findMany({
		where: and(
			eq(payrollPeriods.periodYear, year),
			eq(payrollPeriods.status, PAYROLL_PERIOD_STATUS.CLOSED)
		),
		orderBy: [asc(payrollPeriods.periodMonth)],
	});

	const totals = rows.reduce(
		(accumulator, row) => {
			for (const field of PERIOD_NUMERIC_FIELDS) {
				accumulator[field] += getPeriodTotalValue(row, field) ?? 0;
			}

			accumulator.totalEmployeeCount += row.employeeCount ?? 0;
			return accumulator;
		},
		{
			totalGrossPay: 0,
			totalNetPay: 0,
			totalPaye: 0,
			totalNssfEmployee: 0,
			totalNssfEmployer: 0,
			totalShifEmployee: 0,
			totalShifEmployer: 0,
			totalAhlEmployee: 0,
			totalAhlEmployer: 0,
			totalNita: 0,
			totalLoanDeductions: 0,
			totalAdvanceRecoveries: 0,
			totalOtherDeductions: 0,
			totalPensionEmployer: 0,
			totalEmployeeCount: 0,
		}
	);

	return {
		year,
		totalGrossPay: roundPayrollAmount(totals.totalGrossPay),
		totalNetPay: roundPayrollAmount(totals.totalNetPay),
		totalPaye: roundPayrollAmount(totals.totalPaye),
		totalNssfEmployee: roundPayrollAmount(totals.totalNssfEmployee),
		totalNssfEmployer: roundPayrollAmount(totals.totalNssfEmployer),
		totalNssfCombined: roundPayrollAmount(
			totals.totalNssfEmployee + totals.totalNssfEmployer
		),
		totalShifEmployee: roundPayrollAmount(totals.totalShifEmployee),
		totalShifEmployer: roundPayrollAmount(totals.totalShifEmployer),
		totalShifCombined: roundPayrollAmount(
			totals.totalShifEmployee + totals.totalShifEmployer
		),
		totalAhlEmployee: roundPayrollAmount(totals.totalAhlEmployee),
		totalAhlEmployer: roundPayrollAmount(totals.totalAhlEmployer),
		totalAhlCombined: roundPayrollAmount(
			totals.totalAhlEmployee + totals.totalAhlEmployer
		),
		totalNita: roundPayrollAmount(totals.totalNita),
		totalLoanDeductions: roundPayrollAmount(totals.totalLoanDeductions),
		totalAdvanceRecoveries: roundPayrollAmount(totals.totalAdvanceRecoveries),
		totalPensionEmployer: roundPayrollAmount(totals.totalPensionEmployer),
		totalEmployeeCount: totals.totalEmployeeCount,
		periodCount: rows.length,
	};
}

async function runPayrollPeriodPreflight(periodId: string): Promise<PayrollPeriodPreflightReport> {
	const period = await getPayrollPeriodRecordById(periodId);

	if (!period) {
		return {
			canProceed: false,
			errors: ["Payroll period not found."],
			warnings: [],
			summary: {
				activeEmployeeCount: 0,
				employeesWithNoSalaryStructure: [],
				employeesWithPendingLeave: [],
				approvedOvertimeRecordCount: 0,
				activeLoansCount: 0,
				accountMappingsComplete: false,
				missingAccountMappings: [],
				previousPeriodStatus: null,
				statutoryRatesSource: {},
			},
		};
	}

	const [activeEmployees, accountDiagnostics, previousPeriod, pendingLeaveSummary, approvedOvertimeRows, draftOvertimeRows, activeLoanRows, resolvedRates] =
		await Promise.all([
			getActiveEmployeeDirectory(),
			getAccountMappingDiagnostics(),
			getPreviousPeriodStatus(period.periodMonth, period.periodYear),
			getPendingLeaveSummary(period.periodStart, period.periodEnd),
			db.query.overtimeRecords.findMany({
				columns: { id: true },
				where: and(
					eq(overtimeRecords.periodMonth, period.periodMonth),
					eq(overtimeRecords.periodYear, period.periodYear),
					eq(overtimeRecords.status, "approved")
				),
			}),
			db.query.overtimeRecords.findMany({
				columns: { id: true },
				where: and(
					eq(overtimeRecords.periodMonth, period.periodMonth),
					eq(overtimeRecords.periodYear, period.periodYear),
					eq(overtimeRecords.status, "draft")
				),
			}),
			db.query.employeeLoans.findMany({
				columns: { id: true },
				where: eq(employeeLoans.status, LOAN_STATUS.ACTIVE),
			}),
			resolveStatutoryRates(new Date(`${period.periodEnd}T00:00:00.000Z`), db),
		]);

	const structuresByEmployeeId = await getActiveStructuresByEmployeeId(
		activeEmployees.map((employee) => employee.id),
		period.periodEnd
	);
	const employeesWithNoSalaryStructure = activeEmployees
		.filter((employee) => !structuresByEmployeeId[employee.id])
		.map((employee) => ({
			employeeId: employee.id,
			employeeName: employee.employeeName,
		}));
	const errors: string[] = [];
	const warnings: string[] = [];

	if (period.status !== PAYROLL_PERIOD_STATUS.DRAFT) {
		errors.push("Only draft payroll periods can proceed to processing.");
	}

	if (employeesWithNoSalaryStructure.length > 0) {
		errors.push(
			`The following employees do not have an active salary structure for ${period.name}: ${employeesWithNoSalaryStructure
				.map((employee) => employee.employeeName)
				.join(", ")}.`
		);
	}

	if (activeEmployees.length === 0 || Object.keys(structuresByEmployeeId).length === 0) {
		errors.push("At least one active employee must have a salary structure for this period.");
	}

	if (!accountDiagnostics.accountMappingsComplete) {
		errors.push(
			`Missing or invalid payroll account mappings: ${accountDiagnostics.missingAccountMappings.join(", ")}.`
		);
	}

	if (
		previousPeriod &&
		previousPeriod.status !== PAYROLL_PERIOD_STATUS.CLOSED &&
		previousPeriod.status !== PAYROLL_PERIOD_STATUS.CANCELLED
	) {
		warnings.push(`Previous period is still in ${previousPeriod.status} status.`);
	}

	if (pendingLeaveSummary.length > 0) {
		warnings.push("Some employees have pending leave requests overlapping this period.");
	}

	if (draftOvertimeRows.length > 0) {
		warnings.push(
			`${draftOvertimeRows.length} overtime record(s) are still in draft status and will be excluded from payroll.`
		);
	}

	const constantBackedRates = Object.entries(resolvedRates.resolvedFrom)
		.filter(([, source]) => source === "constant")
		.map(([key]) => key);

	if (constantBackedRates.length > 0) {
		warnings.push(
			`Some statutory rates are resolving from constants instead of the database: ${constantBackedRates.join(", ")}.`
		);
	}

	return {
		canProceed: errors.length === 0,
		errors,
		warnings,
		summary: {
			activeEmployeeCount: activeEmployees.length,
			employeesWithNoSalaryStructure,
			employeesWithPendingLeave: pendingLeaveSummary,
			approvedOvertimeRecordCount: approvedOvertimeRows.length,
			activeLoansCount: activeLoanRows.length,
			accountMappingsComplete: accountDiagnostics.accountMappingsComplete,
			missingAccountMappings: accountDiagnostics.missingAccountMappings,
			previousPeriodStatus: previousPeriod?.status ?? null,
			statutoryRatesSource: resolvedRates.resolvedFrom,
		},
	};
}

async function requirePayrollPeriodsViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:view");
}

async function requirePayrollPeriodsCreateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:create");
}

async function requirePayrollPeriodsTransitionAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:transition");
}

export const getAllPayrollPeriodsFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodFiltersSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getAllPayrollPeriods(data);
	});

export const getPayrollPeriodByIdFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodIdSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getPayrollPeriodById(data.periodId);
	});

export const getActivePayrollPeriodFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollPeriodsViewAccess();
		return getActivePayrollPeriod();
	});

export const getPayrollPeriodByMonthYearFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodMonthYearSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getPayrollPeriodByMonthYear(data.periodMonth, data.periodYear);
	});

export const getPeriodRemittanceStatusFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodIdSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getPeriodRemittanceStatus(data.periodId);
	});

export const getYearToDateTotalsFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodYearSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getYearToDateTotals(data.year);
	});

export const runPayrollPeriodPreflightFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodIdSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return runPayrollPeriodPreflight(data.periodId);
	});

export const createPayrollPeriodFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollPeriodCreateSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollPeriodsCreateAccess();
		const result = await createPayrollPeriod({
			payload: data,
			createdBy: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "create payroll period",
					description: `Created payroll period ${result.data.period.name}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const transitionPayrollPeriodFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollPeriodTransitionSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollPeriodsTransitionAccess();
		const existing = await getPayrollPeriodRecordById(data.periodId);
		const fromStatus = existing?.status ?? "unknown";
		const result = await transitionPayrollPeriod({
			...data,
			performedBy: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "transition payroll period",
					description: `Moved payroll period ${result.data.name} from ${fromStatus} to ${data.targetStatus}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const updatePayrollPeriodTotalsFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollPeriodIdSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollPeriodsTransitionAccess();
		const result = await updatePeriodTotals(data.periodId);

		if (result.success) {
			await logActivity({
				data: {
					action: "update payroll period totals",
					description: `Updated totals for payroll period ${result.data.name}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});
