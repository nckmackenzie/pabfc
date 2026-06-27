import {
	addMonths,
	differenceInCalendarDays,
	endOfMonth,
	format,
	getMonth,
	getYear,
	isAfter,
	isBefore,
	isSunday,
	parseISO,
	setDate,
	startOfDay,
	startOfMonth,
} from "date-fns";
import {
	PAYROLL_MONTH_MAX,
	PAYROLL_MONTH_MIN,
	PAYROLL_PAY_DATE_FOLLOWING_MONTH_GRACE_DAYS,
	PAYROLL_PERIOD_STATUS,
	PAYROLL_PERIOD_YEAR_MAX,
	PAYROLL_PERIOD_YEAR_MIN,
	PAYROLL_STATUS_TRANSITIONS,
	STATUTORY_REMITTANCE_DAY,
} from "@/features/payroll/lib/payroll-constants";
import type {
	PayrollPeriodCreatePayload,
	PayrollPeriodView,
	PayrollTransitionAbort,
} from "./types";
import { roundDecimal, toNumber } from "@/lib/helpers";
import type { PayrollPeriodRecord } from "../payroll.types";
import type { PERIOD_NUMERIC_FIELDS } from "../../services/payroll-periods.api";

export function toPeriodInsertValues(payload: PayrollPeriodCreatePayload, createdBy: string) {
	const periodMonth = toNumber(payload.periodMonth);
	return {
		name: getPayrollPeriodName(periodMonth, payload.periodYear),
		periodMonth,
		periodYear: payload.periodYear,
		periodStart: getPayrollPeriodStart(periodMonth, payload.periodYear),
		periodEnd: getPayrollPeriodEnd(periodMonth, payload.periodYear),
		payDate: payload.payDate,
		status: PAYROLL_PERIOD_STATUS.DRAFT,
		createdBy,
	};
}
export function toPayrollPeriodView(row: PayrollPeriodRecord): PayrollPeriodView {
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
		processingWarnings: parseJsonArray(row.processingWarnings),
		skippedEmployees: parseJsonArray(row.skippedEmployees),
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
		daysUntilRemittanceDeadline: getDaysUntilPayrollRemittanceDeadline(statutoryRemittanceDeadline),
		allowedTransitions: PAYROLL_STATUS_TRANSITIONS[row.status],
	};
}

export function sumNumbers(values: Array<number | null | undefined>) {
	return roundDecimal(values.reduce<number>((total, value) => total + (value ?? 0), 0));
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
	if (!value) {
		return [];
	}

	try {
		return JSON.parse(value) as T[];
	} catch {
		return [];
	}
}

export function isPayrollTransitionAbort(error: unknown): error is PayrollTransitionAbort {
	return Boolean(error && typeof error === "object" && "appError" in error);
}

export function getPeriodTotalValue(
	row: PayrollPeriodRecord,
	key: (typeof PERIOD_NUMERIC_FIELDS)[number]
) {
	return toNumber(row[key]);
}

function getPayrollPeriodAnchorDate(periodMonth: number, periodYear: number) {
	return new Date(periodYear, periodMonth - 1, 1);
}

export function isValidPayrollPeriodParts(periodMonth: number, periodYear: number) {
	return (
		periodMonth >= PAYROLL_MONTH_MIN &&
		periodMonth <= PAYROLL_MONTH_MAX &&
		periodYear >= PAYROLL_PERIOD_YEAR_MIN &&
		periodYear <= PAYROLL_PERIOD_YEAR_MAX
	);
}

export function getPayrollPeriodStart(periodMonth: number, periodYear: number) {
	return format(startOfMonth(getPayrollPeriodAnchorDate(periodMonth, periodYear)), "yyyy-MM-dd");
}

export function getPayrollPeriodEnd(periodMonth: number, periodYear: number) {
	return format(endOfMonth(getPayrollPeriodAnchorDate(periodMonth, periodYear)), "yyyy-MM-dd");
}

export function getPayrollPeriodName(periodMonth: number, periodYear: number) {
	return format(getPayrollPeriodAnchorDate(periodMonth, periodYear), "LLLL yyyy");
}

export function getPayrollPeriodRemittanceDeadline(periodMonth: number, periodYear: number) {
	const nextMonth = addMonths(getPayrollPeriodAnchorDate(periodMonth, periodYear), 1);
	return format(setDate(startOfMonth(nextMonth), STATUTORY_REMITTANCE_DAY), "yyyy-MM-dd");
}

export function getPayrollPayDateWindow(periodMonth: number, periodYear: number) {
	const anchorDate = getPayrollPeriodAnchorDate(periodMonth, periodYear);
	const periodStart = startOfMonth(anchorDate);
	const graceWindowEnd = setDate(
		startOfMonth(addMonths(anchorDate, 1)),
		PAYROLL_PAY_DATE_FOLLOWING_MONTH_GRACE_DAYS
	);

	return {
		start: format(periodStart, "yyyy-MM-dd"),
		end: format(graceWindowEnd, "yyyy-MM-dd"),
	};
}

export function isPayrollPayDateAllowed(payDate: string, periodMonth: number, periodYear: number) {
	const parsedPayDate = parseISO(payDate);
	const { start, end } = getPayrollPayDateWindow(periodMonth, periodYear);

	return !isBefore(parsedPayDate, parseISO(start)) && !isAfter(parsedPayDate, parseISO(end));
}

export function isPayrollPayDateSunday(payDate: string) {
	return isSunday(parseISO(payDate));
}

export function getPreviousPayrollPeriod(periodMonth: number, periodYear: number) {
	const previousDate = addMonths(getPayrollPeriodAnchorDate(periodMonth, periodYear), -1);

	return {
		periodMonth: getMonth(previousDate) + 1,
		periodYear: getYear(previousDate),
	};
}

export function getDaysUntilPayrollRemittanceDeadline(deadline: string, today = new Date()) {
	return differenceInCalendarDays(parseISO(deadline), startOfDay(today));
}
