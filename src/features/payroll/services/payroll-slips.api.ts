import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/drizzle/db";
import type * as schema from "@/drizzle/schema";
import {
	departments,
	employeeLoans,
	employees,
	leaveRequests,
	loanRepayments,
	overtimeRecords,
	payrollDeductions,
	payrollPeriodBonuses,
	payrollPeriodOtherDeductions,
	payrollPeriods,
	payrollSlips,
	publicHolidays,
	salaryAdvanceRecoveries,
	salaryAdvances,
	salaryStructures,
} from "@/drizzle/schema";
import { computeSingleInstalment } from "@/features/payroll/lib/loan-helpers";
import {
	LOAN_STATUS,
	PAYROLL_PERIOD_STATUS,
	PRORATION_MINIMUM_DAYS,
	SALARY_ADVANCE_STATUS,
} from "@/features/payroll/lib/payroll-constants";
import {
	normalizePayrollText,
	roundPayrollAmount,
	toPayrollDecimalString,
} from "@/features/payroll/lib/helpers";
import {
	resolveStatutoryRates,
	type PayrollDbClient,
	type ResolvedStatutoryRates,
} from "@/features/payroll/lib/payroll-rate-resolver";
import {
	computeEmployeeProratedDays,
	computeWorkingDaysInMonth,
} from "@/features/payroll/lib/proration";
import {
	computeEmployeeSlip,
	type ComputedEmployeeSlip,
	type ComputedPayrollDeductionLine,
} from "@/features/payroll/lib/slip-computation";
import {
	getAccountMappingsAsMapFn,
	// validateAllMappingsExist,
	validateAllMappingsExistFn,
} from "@/features/payroll/services/account-mappings.api";
import {
	employeePayrollHistorySchema,
	payrollDepartmentSummarySchema,
	payrollPeriodAdjustmentOptionsSchema,
	payrollSlipBonusSchema,
	payrollSlipCancelSchema,
	payrollSlipForEmployeeSchema,
	payrollSlipIdSchema,
	payrollSlipPeriodSearchSchema,
} from "@/features/payroll/services/payroll-slips.schemas";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import { requiredStringNonLowerSchemaEntry } from "@/lib/schema-rules";
import type {
	DepartmentPayrollSummaryItem,
	EmployeePayrollHistoryItem,
	EmployeeRecord,
	ManualOtherDeductionType,
	OvertimeRecord,
	PayrollAdjustmentOptions,
	PayrollDeductionRecord,
	PayrollPeriodRecord,
	PayrollRunResult,
	PayrollRunSuccess,
	PayrollSlipRecord,
	SalaryStructureRecord,
	SkippedEmployee,
	SlipWarning,
} from "../lib/payroll.types";
import {
	getEligibleEmployeesForPeriod,
	reverseSlip,
	updatePayrollPeriodAggregates,
} from "./payroll.server";
import { sumValues } from "../lib/payroll-journal-helpers";
import { toNullableNumber, toNumber } from "@/lib/helpers";
import { todayIsoDate } from "@/features/leaves/utils/helpers";
import {
	bonusFormSchema,
	payrollPeriodIdSchema,
	type BonusFormValues,
	payrollPeriodOtherDeductionCreateSchema,
	type DeductionFormValues,
} from "./payroll-period.schemas";

export type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

type PayrollSlipDetailView = ReturnType<typeof mapSlipRecord> & {
	employeeName: string;
	employeeNo: string;
	departmentName: string | null;
	deductions: Array<ReturnType<typeof mapDeductionRecord>>;
};

type PayrollSlipListItem = ReturnType<typeof mapSlipRecord> & {
	employeeName: string;
	employeeNo: string;
	departmentId: number | null;
	departmentName: string | null;
};

function mapSlipRecord(record: PayrollSlipRecord) {
	return {
		id: record.id,
		payrollPeriodId: record.payrollPeriodId,
		employeeId: record.employeeId,
		salaryStructureId: record.salaryStructureId,
		status: record.status,
		isProrated: record.isProrated,
		proratedDays: record.proratedDays,
		totalWorkingDaysInPeriod: record.totalWorkingDaysInPeriod,
		proratedReason: record.proratedReason,
		basicSalary: toNumber(record.basicSalary),
		houseAllowance: toNumber(record.houseAllowance),
		transportAllowance: toNumber(record.transportAllowance),
		commuterAllowance: toNumber(record.commuterAllowance),
		mealAllowance: toNumber(record.mealAllowance),
		airtimeAllowance: toNumber(record.airtimeAllowance),
		otherAllowances: toNumber(record.otherAllowances),
		overtimePay: toNumber(record.overtimePay),
		bonuses: toNumber(record.bonuses),
		grossPay: toNumber(record.grossPay),
		fullMonthGrossPay: toNumber(record.fullMonthGrossPay),
		overtimeRecordId: record.overtimeRecordId,
		weekdayOvertimeHours: toNullableNumber(record.weekdayOvertimeHours),
		weekendOvertimeHours: toNullableNumber(record.weekendOvertimeHours),
		publicHolidayOvertimeHours: toNullableNumber(record.publicHolidayOvertimeHours),
		unpaidLeaveDays: record.unpaidLeaveDays,
		halfPayLeaveDays: record.halfPayLeaveDays,
		leaveDeductionAmount: toNumber(record.leaveDeductionAmount),
		nssfTier1Employee: toNumber(record.nssfTier1Employee),
		nssfTier1Employer: toNumber(record.nssfTier1Employer),
		nssfTier2Employee: toNumber(record.nssfTier2Employee),
		nssfTier2Employer: toNumber(record.nssfTier2Employer),
		nssfEmployee: toNumber(record.nssfEmployee),
		nssfEmployer: toNumber(record.nssfEmployer),
		shifEmployee: toNumber(record.shifEmployee),
		shifEmployer: toNumber(record.shifEmployer),
		ahlEmployee: toNumber(record.ahlEmployee),
		ahlEmployer: toNumber(record.ahlEmployer),
		nitaLevy: toNumber(record.nitaLevy),
		pensionAllowableDeduction: toNumber(record.pensionAllowableDeduction),
		mortgageAllowableDeduction: toNumber(record.mortgageAllowableDeduction),
		postRetirementAllowableDeduction: toNumber(record.postRetirementAllowableDeduction),
		mealAllowanceExempt: toNumber(record.mealAllowanceExempt),
		nonCashBenefitExempt: toNumber(record.nonCashBenefitExempt),
		taxableIncome: toNumber(record.taxableIncome),
		grossTax: toNumber(record.grossTax),
		personalRelief: toNumber(record.personalRelief),
		insuranceRelief: toNumber(record.insuranceRelief),
		netPaye: toNumber(record.netPaye),
		payeBandBreakdown: record.payeBandBreakdown ? JSON.parse(record.payeBandBreakdown) : [],
		pensionEmployeeDeduction: toNumber(record.pensionEmployeeDeduction),
		pensionEmployerContribution: toNumber(record.pensionEmployerContribution),
		totalEmployerCost: toNumber(record.totalEmployerCost),
		totalLoanDeductions: toNumber(record.totalLoanDeductions),
		totalAdvanceRecoveries: toNumber(record.totalAdvanceRecoveries),
		totalOtherDeductions: toNumber(record.totalOtherDeductions),
		helbDeduction: toNumber(record.helbDeduction),
		totalStatutoryDeductions: toNumber(record.totalStatutoryDeductions),
		totalVoluntaryDeductions: toNumber(record.totalVoluntaryDeductions),
		totalDeductions: toNumber(record.totalDeductions),
		netPay: toNumber(record.netPay),
		twoThirdsCapApplied: record.twoThirdsCapApplied,
		twoThirdsCapAmount: toNullableNumber(record.twoThirdsCapAmount),
		notes: record.notes,
		approvedBy: record.approvedBy,
		approvedAt: record.approvedAt,
		cancelledBy: record.cancelledBy,
		cancelledAt: record.cancelledAt,
		cancellationReason: record.cancellationReason,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
}

function mapDeductionRecord(record: PayrollDeductionRecord) {
	return {
		id: record.id,
		payrollSlipId: record.payrollSlipId,
		payrollPeriodId: record.payrollPeriodId,
		employeeId: record.employeeId,
		deductionType: record.deductionType,
		description: record.description,
		amount: toNumber(record.amount),
		loanId: record.loanId,
		advanceId: record.advanceId,
		createdAt: record.createdAt,
	};
}

// function sumValues(values: Array<number | null | undefined>) {
// 	return roundPayrollAmount(values.reduce<number>((total, value) => total + (value ?? 0), 0));
// }

function parseLeavePayrollImpactNotes(notes: string | null) {
	if (!notes) {
		return { unpaidLeaveDays: 0, halfPayLeaveDays: 0 };
	}

	const halfPayMatch = notes.match(/([\d.]+)\s+days?\s+half\s+pay/i);
	return {
		unpaidLeaveDays: 0,
		halfPayLeaveDays: halfPayMatch ? Math.round(Number.parseFloat(halfPayMatch[1] ?? "0")) : 0,
	};
}

function buildLeaveImpactMap(rows: Array<typeof leaveRequests.$inferSelect>) {
	const map = new Map<
		string,
		{
			unpaidLeaveDays: number;
			halfPayLeaveDays: number;
		}
	>();

	for (const row of rows) {
		const current = map.get(row.employeeId) ?? {
			unpaidLeaveDays: 0,
			halfPayLeaveDays: 0,
		};

		if (row.leaveType === "unpaid") {
			current.unpaidLeaveDays += Math.round(toNumber(row.workingDaysRequested));
		} else {
			const parsed = parseLeavePayrollImpactNotes(row.payrollImpactNotes);
			current.halfPayLeaveDays += parsed.halfPayLeaveDays;
		}

		map.set(row.employeeId, current);
	}

	return map;
}

function getDepartmentKey(departmentId: number | null) {
	return departmentId === null ? "none" : String(departmentId);
}

function getEmployeeDisplayName(employee: Pick<EmployeeRecord, "firstName" | "lastName">) {
	return `${employee.firstName} ${employee.lastName}`.trim();
}

async function getPayrollPeriodRecord(periodId: string, dbClient: PayrollDbClient = db) {
	return dbClient.query.payrollPeriods.findFirst({
		where: eq(payrollPeriods.id, periodId),
	});
}

function getRepaymentPeriodIndex(periodMonth: number, periodYear: number) {
	return periodYear * 100 + periodMonth;
}

async function getStructuresForEmployees(
	employeeIds: string[],
	periodEnd: string,
	dbClient: PayrollDbClient = db
) {
	if (!employeeIds.length) {
		return new Map<string, SalaryStructureRecord>();
	}

	const rows = await dbClient.query.salaryStructures.findMany({
		where: and(
			inArray(salaryStructures.employeeId, employeeIds),
			lte(salaryStructures.effectiveFrom, periodEnd),
			or(isNull(salaryStructures.effectiveTo), gte(salaryStructures.effectiveTo, periodEnd))
		),
		orderBy: [
			asc(salaryStructures.employeeId),
			desc(salaryStructures.effectiveFrom),
			desc(salaryStructures.id),
		],
	});

	const map = new Map<string, SalaryStructureRecord>();

	for (const row of rows) {
		if (!map.has(row.employeeId)) {
			map.set(row.employeeId, row);
		}
	}

	return map;
}

// async function getEligibleEmployeesForPeriod(period: PayrollPeriodRecord) {
// 	return db.query.employees.findMany({
// 		where: and(
// 			isNull(employees.deletedAt),
// 			or(
// 				eq(employees.status, "active"),
// 				and(
// 					lte(employees.terminationDate, period.periodEnd),
// 					gte(employees.terminationDate, period.periodStart)
// 				)
// 			)
// 		),
// 		orderBy: [asc(employees.firstName), asc(employees.lastName)],
// 	});
// }

async function getPublicHolidayDates(period: PayrollPeriodRecord) {
	const rows = await db
		.select({
			holidayDate: publicHolidays.holidayDate,
		})
		.from(publicHolidays)
		.where(
			and(
				gte(publicHolidays.holidayDate, period.periodStart),
				lte(publicHolidays.holidayDate, period.periodEnd)
			)
		);

	return rows.map((row) => row.holidayDate);
}

async function getLeaveRowsForPeriod(period: PayrollPeriodRecord) {
	return db.query.leaveRequests.findMany({
		where: and(
			eq(leaveRequests.status, "approved"),
			eq(leaveRequests.affectsPayroll, true),
			lte(leaveRequests.startDate, period.periodEnd),
			gte(leaveRequests.endDate, period.periodStart)
		),
	});
}

async function getOvertimeByEmployee(period: PayrollPeriodRecord) {
	const rows = await db.query.overtimeRecords.findMany({
		where: and(
			eq(overtimeRecords.periodMonth, period.periodMonth),
			eq(overtimeRecords.periodYear, period.periodYear),
			eq(overtimeRecords.status, "approved")
		),
		orderBy: [asc(overtimeRecords.employeeId)],
	});

	return new Map(rows.map((row) => [row.employeeId, row]));
}

async function getLoanMapForPeriod(period: PayrollPeriodRecord) {
	const rows = await db.query.employeeLoans.findMany({
		where: and(
			eq(employeeLoans.status, LOAN_STATUS.ACTIVE),
			ne(employeeLoans.outstandingBalance, "0")
		),
	});

	const map = new Map<
		string,
		Array<{ loanId: string; monthlyInstalment: number; description: string }>
	>();
	const targetIndex = getRepaymentPeriodIndex(period.periodMonth, period.periodYear);

	for (const row of rows) {
		if (
			row.monthlyInstalment === null ||
			row.repaymentStartMonth === null ||
			row.repaymentStartYear === null ||
			toNumber(row.outstandingBalance) <= 0
		) {
			continue;
		}

		const startIndex = getRepaymentPeriodIndex(row.repaymentStartMonth, row.repaymentStartYear);

		if (targetIndex < startIndex) {
			continue;
		}

		const employeeLoansList = map.get(row.employeeId) ?? [];
		employeeLoansList.push({
			loanId: row.id,
			monthlyInstalment: toNumber(row.monthlyInstalment),
			description: `Loan repayment ${row.id}`,
		});
		map.set(row.employeeId, employeeLoansList);
	}

	return map;
}

async function getAdvanceMapForPeriod(period: PayrollPeriodRecord) {
	const rows = await db.query.salaryAdvances.findMany({
		where: and(
			inArray(salaryAdvances.status, [
				SALARY_ADVANCE_STATUS.DISBURSED,
				SALARY_ADVANCE_STATUS.RECOVERING,
			]),
			ne(salaryAdvances.outstandingBalance, "0")
		),
	});
	const map = new Map<
		string,
		Array<{ advanceId: string; recoveryAmount: number; description: string }>
	>();
	const targetIndex = getRepaymentPeriodIndex(period.periodMonth, period.periodYear);

	for (const row of rows) {
		if (
			row.monthlyRecoveryAmount === null ||
			row.recoveryStartMonth === null ||
			row.recoveryStartYear === null ||
			toNumber(row.outstandingBalance) <= 0
		) {
			continue;
		}

		const startIndex = getRepaymentPeriodIndex(row.recoveryStartMonth, row.recoveryStartYear);

		if (targetIndex < startIndex) {
			continue;
		}

		const advancesForEmployee = map.get(row.employeeId) ?? [];
		advancesForEmployee.push({
			advanceId: row.id,
			// Cap to outstandingBalance so the final (shorter) instalment doesn't over-deduct.
			recoveryAmount: Math.min(
				toNumber(row.monthlyRecoveryAmount),
				toNumber(row.outstandingBalance)
			),
			description: `Salary advance recovery ${row.id}`,
		});
		map.set(row.employeeId, advancesForEmployee);
	}

	return map;
}

async function getBonusMapForPeriod(periodId: string, dbClient: PayrollDbClient = db) {
	const rows = await dbClient.query.payrollPeriodBonuses.findMany({
		where: eq(payrollPeriodBonuses.payrollPeriodId, periodId),
		orderBy: [asc(payrollPeriodBonuses.createdAt)],
	});
	const map = new Map<string, Array<{ amount: number; description: string }>>();

	for (const row of rows) {
		const bonuses = map.get(row.employeeId) ?? [];
		bonuses.push({
			amount: toNumber(row.amount),
			description: row.description,
		});
		map.set(row.employeeId, bonuses);
	}

	return { rows, map };
}

async function getOtherDeductionMapForPeriod(periodId: string, dbClient: PayrollDbClient = db) {
	const rows = await dbClient.query.payrollPeriodOtherDeductions.findMany({
		where: eq(payrollPeriodOtherDeductions.payrollPeriodId, periodId),
		orderBy: [asc(payrollPeriodOtherDeductions.createdAt)],
	});
	const map = new Map<
		string,
		Array<{
			type: ManualOtherDeductionType;
			amount: number;
			description: string;
		}>
	>();

	for (const row of rows) {
		const deductions = map.get(row.employeeId) ?? [];
		deductions.push({
			type: row.deductionType as ManualOtherDeductionType,
			amount: toNumber(row.amount),
			description: row.description,
		});
		map.set(row.employeeId, deductions);
	}

	return { rows, map };
}

// async function calculatePayrollPeriodTotals(
// 	periodId: string,
// 	dbClient: PayrollDbClient = db
// ): Promise<PayrollPeriodTotals> {
// 	const rows = await dbClient.query.payrollSlips.findMany({
// 		where: and(eq(payrollSlips.payrollPeriodId, periodId), ne(payrollSlips.status, "cancelled")),
// 	});

// 	return rows.reduce<PayrollPeriodTotals>(
// 		(accumulator, slip) => {
// 			accumulator.totalGrossPay = sumValues([accumulator.totalGrossPay, toNumber(slip.grossPay)]);
// 			accumulator.totalNetPay = sumValues([accumulator.totalNetPay, toNumber(slip.netPay)]);
// 			accumulator.totalPaye = sumValues([accumulator.totalPaye, toNumber(slip.netPaye)]);
// 			accumulator.totalNssfEmployee = sumValues([
// 				accumulator.totalNssfEmployee,
// 				toNumber(slip.nssfEmployee),
// 			]);
// 			accumulator.totalNssfEmployer = sumValues([
// 				accumulator.totalNssfEmployer,
// 				toNumber(slip.nssfEmployer),
// 			]);
// 			accumulator.totalShifEmployee = sumValues([
// 				accumulator.totalShifEmployee,
// 				toNumber(slip.shifEmployee),
// 			]);
// 			accumulator.totalShifEmployer = sumValues([
// 				accumulator.totalShifEmployer,
// 				toNumber(slip.shifEmployer),
// 			]);
// 			accumulator.totalAhlEmployee = sumValues([
// 				accumulator.totalAhlEmployee,
// 				toNumber(slip.ahlEmployee),
// 			]);
// 			accumulator.totalAhlEmployer = sumValues([
// 				accumulator.totalAhlEmployer,
// 				toNumber(slip.ahlEmployer),
// 			]);
// 			accumulator.totalNita = sumValues([accumulator.totalNita, toNumber(slip.nitaLevy)]);
// 			accumulator.totalLoanDeductions = sumValues([
// 				accumulator.totalLoanDeductions,
// 				toNumber(slip.totalLoanDeductions),
// 			]);
// 			accumulator.totalAdvanceRecoveries = sumValues([
// 				accumulator.totalAdvanceRecoveries,
// 				toNumber(slip.totalAdvanceRecoveries),
// 			]);
// 			accumulator.totalOtherDeductions = sumValues([
// 				accumulator.totalOtherDeductions,
// 				toNumber(slip.totalOtherDeductions),
// 			]);
// 			accumulator.totalPensionEmployer = sumValues([
// 				accumulator.totalPensionEmployer,
// 				toNumber(slip.pensionEmployerContribution),
// 			]);
// 			accumulator.totalEmployerCost = sumValues([
// 				accumulator.totalEmployerCost,
// 				toNumber(slip.totalEmployerCost),
// 			]);
// 			accumulator.employeeCount += 1;
// 			return accumulator;
// 		},
// 		{
// 			totalGrossPay: 0,
// 			totalNetPay: 0,
// 			totalPaye: 0,
// 			totalNssfEmployee: 0,
// 			totalNssfEmployer: 0,
// 			totalShifEmployee: 0,
// 			totalShifEmployer: 0,
// 			totalAhlEmployee: 0,
// 			totalAhlEmployer: 0,
// 			totalNita: 0,
// 			totalLoanDeductions: 0,
// 			totalAdvanceRecoveries: 0,
// 			totalOtherDeductions: 0,
// 			totalPensionEmployer: 0,
// 			totalEmployerCost: 0,
// 			employeeCount: 0,
// 		}
// 	);
// }

// async function updatePayrollPeriodAggregates(
// 	periodId: string,
// 	dbClient: PayrollDbClient = db,
// 	options?: {
// 		processingWarnings?: SlipWarning[];
// 		skippedEmployees?: SkippedEmployee[];
// 		status?: PayrollPeriodRecord["status"];
// 		processingStartedAt?: Date;
// 		processingCompletedAt?: Date | null;
// 		cancelledBy?: string | null;
// 		cancelledAt?: Date | null;
// 		cancellationReason?: string | null;
// 	}
// ) {
// 	const totals = await calculatePayrollPeriodTotals(periodId, dbClient);
// 	const [updated] = await dbClient
// 		.update(payrollPeriods)
// 		.set({
// 			totalGrossPay: toPayrollDecimalString(totals.totalGrossPay),
// 			totalNetPay: toPayrollDecimalString(totals.totalNetPay),
// 			totalPaye: toPayrollDecimalString(totals.totalPaye),
// 			totalNssfEmployee: toPayrollDecimalString(totals.totalNssfEmployee),
// 			totalNssfEmployer: toPayrollDecimalString(totals.totalNssfEmployer),
// 			totalShifEmployee: toPayrollDecimalString(totals.totalShifEmployee),
// 			totalShifEmployer: toPayrollDecimalString(totals.totalShifEmployer),
// 			totalAhlEmployee: toPayrollDecimalString(totals.totalAhlEmployee),
// 			totalAhlEmployer: toPayrollDecimalString(totals.totalAhlEmployer),
// 			totalNita: toPayrollDecimalString(totals.totalNita),
// 			totalLoanDeductions: toPayrollDecimalString(totals.totalLoanDeductions),
// 			totalAdvanceRecoveries: toPayrollDecimalString(totals.totalAdvanceRecoveries),
// 			totalOtherDeductions: toPayrollDecimalString(totals.totalOtherDeductions),
// 			totalPensionEmployer: toPayrollDecimalString(totals.totalPensionEmployer),
// 			employeeCount: totals.employeeCount,
// 			processingWarnings: options?.processingWarnings
// 				? JSON.stringify(options.processingWarnings)
// 				: undefined,
// 			skippedEmployees: options?.skippedEmployees
// 				? JSON.stringify(options.skippedEmployees)
// 				: undefined,
// 			status: options?.status,
// 			processingStartedAt: options?.processingStartedAt,
// 			processingCompletedAt: options?.processingCompletedAt ?? undefined,
// 			cancelledBy: options?.cancelledBy !== undefined ? options.cancelledBy : undefined,
// 			cancelledAt: options?.cancelledAt !== undefined ? options.cancelledAt : undefined,
// 			cancellationReason:
// 				options?.cancellationReason !== undefined
// 					? normalizePayrollText(options.cancellationReason)
// 					: undefined,
// 			updatedAt: new Date(),
// 		})
// 		.where(eq(payrollPeriods.id, periodId))
// 		.returning();

// 	return { period: updated, totals };
// }

function buildSlipPayload(
	employee: EmployeeRecord,
	structure: SalaryStructureRecord,
	prorationInfo: ReturnType<typeof computeEmployeeProratedDays>,
	overtimeRecord: OvertimeRecord | null,
	leaveImpact: { unpaidLeaveDays: number; halfPayLeaveDays: number },
	loans: Array<{ loanId: string; monthlyInstalment: number; description: string }>,
	advances: Array<{ advanceId: string; recoveryAmount: number; description: string }>,
	bonuses: Array<{ amount: number; description: string }>,
	otherDeductions: Array<{
		type: ManualOtherDeductionType;
		amount: number;
		description: string;
	}>,
	rates: ResolvedStatutoryRates
) {
	return computeEmployeeSlip({
		employee: {
			id: employee.id,
			hasHelbLoan: structure.hasHelbLoan,
			helbMonthlyDeduction: toNumber(structure.helbMonthlyDeduction),
		},
		salaryStructure: {
			id: structure.id,
			basicSalary: toNumber(structure.basicSalary),
			houseAllowance: toNumber(structure.houseAllowance),
			transportAllowance: toNumber(structure.transportAllowance),
			commuterAllowance: toNumber(structure.commuterAllowance),
			mealAllowance: toNumber(structure.mealAllowance),
			airtimeAllowance: toNumber(structure.airtimeAllowance),
			otherAllowances: toNumber(structure.otherAllowances),
			pensionEmployeeContribution: toNumber(structure.pensionEmployeeContribution),
			pensionEmployerContribution: toNumber(structure.pensionEmployerContribution),
			mortgageInterestMonthly: toNumber(structure.mortgageInterestMonthly),
			postRetirementMedicalMonthly: toNumber(structure.postRetirementMedicalMonthly),
			insurancePremiumsMonthly: toNumber(structure.insurancePremiumsMonthly),
		},
		prorationInfo,
		overtimeRecord: overtimeRecord
			? {
					id: overtimeRecord.id,
					weekdayOvertimeHours: toNumber(overtimeRecord.weekdayOvertimeHours),
					weekendOvertimeHours: toNumber(overtimeRecord.weekendOvertimeHours),
					publicHolidayOvertimeHours: toNumber(overtimeRecord.publicHolidayOvertimeHours),
					totalOvertimePay: toNumber(overtimeRecord.totalOvertimePay),
				}
			: null,
		leaveImpact: {
			unpaidLeaveDays: leaveImpact.unpaidLeaveDays,
			halfPayLeaveDays: leaveImpact.halfPayLeaveDays,
			workingDaysInMonth: prorationInfo.totalWorkingDays,
		},
		loans,
		advances,
		bonuses,
		otherDeductions,
		rates,
	});
}

function toSlipInsertValues(
	computedSlip: ComputedEmployeeSlip,
	periodId: string,
	employeeId: string
): typeof payrollSlips.$inferInsert {
	return {
		payrollPeriodId: periodId,
		employeeId,
		salaryStructureId: computedSlip.salaryStructureId,
		status: "draft",
		isProrated: computedSlip.isProrated,
		proratedDays: computedSlip.proratedDays,
		totalWorkingDaysInPeriod: computedSlip.totalWorkingDaysInPeriod,
		proratedReason: computedSlip.proratedReason,
		basicSalary: toPayrollDecimalString(computedSlip.basicSalary),
		houseAllowance: toPayrollDecimalString(computedSlip.houseAllowance),
		transportAllowance: toPayrollDecimalString(computedSlip.transportAllowance),
		commuterAllowance: toPayrollDecimalString(computedSlip.commuterAllowance),
		mealAllowance: toPayrollDecimalString(computedSlip.mealAllowance),
		airtimeAllowance: toPayrollDecimalString(computedSlip.airtimeAllowance),
		otherAllowances: toPayrollDecimalString(computedSlip.otherAllowances),
		overtimePay: toPayrollDecimalString(computedSlip.overtimePay),
		bonuses: toPayrollDecimalString(computedSlip.bonuses),
		grossPay: toPayrollDecimalString(computedSlip.grossPay),
		fullMonthGrossPay: toPayrollDecimalString(computedSlip.fullMonthGrossPay),
		overtimeRecordId: computedSlip.overtimeRecordId,
		weekdayOvertimeHours:
			computedSlip.weekdayOvertimeHours === null
				? null
				: toPayrollDecimalString(computedSlip.weekdayOvertimeHours),
		weekendOvertimeHours:
			computedSlip.weekendOvertimeHours === null
				? null
				: toPayrollDecimalString(computedSlip.weekendOvertimeHours),
		publicHolidayOvertimeHours:
			computedSlip.publicHolidayOvertimeHours === null
				? null
				: toPayrollDecimalString(computedSlip.publicHolidayOvertimeHours),
		unpaidLeaveDays: computedSlip.unpaidLeaveDays,
		halfPayLeaveDays: computedSlip.halfPayLeaveDays,
		leaveDeductionAmount: toPayrollDecimalString(computedSlip.leaveDeductionAmount),
		nssfTier1Employee: toPayrollDecimalString(computedSlip.nssfTier1Employee),
		nssfTier1Employer: toPayrollDecimalString(computedSlip.nssfTier1Employer),
		nssfTier2Employee: toPayrollDecimalString(computedSlip.nssfTier2Employee),
		nssfTier2Employer: toPayrollDecimalString(computedSlip.nssfTier2Employer),
		nssfEmployee: toPayrollDecimalString(computedSlip.nssfEmployee),
		nssfEmployer: toPayrollDecimalString(computedSlip.nssfEmployer),
		shifEmployee: toPayrollDecimalString(computedSlip.shifEmployee),
		shifEmployer: toPayrollDecimalString(computedSlip.shifEmployer),
		ahlEmployee: toPayrollDecimalString(computedSlip.ahlEmployee),
		ahlEmployer: toPayrollDecimalString(computedSlip.ahlEmployer),
		nitaLevy: toPayrollDecimalString(computedSlip.nitaLevy),
		pensionAllowableDeduction: toPayrollDecimalString(computedSlip.pensionAllowableDeduction),
		mortgageAllowableDeduction: toPayrollDecimalString(computedSlip.mortgageAllowableDeduction),
		postRetirementAllowableDeduction: toPayrollDecimalString(
			computedSlip.postRetirementAllowableDeduction
		),
		mealAllowanceExempt: toPayrollDecimalString(computedSlip.mealAllowanceExempt),
		nonCashBenefitExempt: toPayrollDecimalString(computedSlip.nonCashBenefitExempt),
		taxableIncome: toPayrollDecimalString(computedSlip.taxableIncome),
		grossTax: toPayrollDecimalString(computedSlip.grossTax),
		personalRelief: toPayrollDecimalString(computedSlip.personalRelief),
		insuranceRelief: toPayrollDecimalString(computedSlip.insuranceRelief),
		netPaye: toPayrollDecimalString(computedSlip.netPaye),
		payeBandBreakdown: computedSlip.payeBandBreakdown,
		pensionEmployeeDeduction: toPayrollDecimalString(computedSlip.pensionEmployeeDeduction),
		pensionEmployerContribution: toPayrollDecimalString(computedSlip.pensionEmployerContribution),
		totalEmployerCost: toPayrollDecimalString(computedSlip.totalEmployerCost),
		totalLoanDeductions: toPayrollDecimalString(computedSlip.totalLoanDeductions),
		totalAdvanceRecoveries: toPayrollDecimalString(computedSlip.totalAdvanceRecoveries),
		totalOtherDeductions: toPayrollDecimalString(computedSlip.totalOtherDeductions),
		helbDeduction: toPayrollDecimalString(computedSlip.helbDeduction),
		totalStatutoryDeductions: toPayrollDecimalString(computedSlip.totalStatutoryDeductions),
		totalVoluntaryDeductions: toPayrollDecimalString(computedSlip.totalVoluntaryDeductions),
		totalDeductions: toPayrollDecimalString(computedSlip.totalDeductions),
		netPay: toPayrollDecimalString(computedSlip.netPay),
		twoThirdsCapApplied: computedSlip.twoThirdsCapApplied,
		twoThirdsCapAmount:
			computedSlip.twoThirdsCapAmount === null
				? null
				: toPayrollDecimalString(computedSlip.twoThirdsCapAmount),
	};
}

async function insertPayrollDeductions(
	tx: Transaction,
	slipId: string,
	periodId: string,
	employeeId: string,
	lines: ComputedPayrollDeductionLine[]
) {
	if (lines.length === 0) {
		return;
	}

	await tx.insert(payrollDeductions).values(
		lines.map((line) => ({
			payrollSlipId: slipId,
			payrollPeriodId: periodId,
			employeeId,
			deductionType: line.deductionType,
			description: line.description,
			amount: toPayrollDecimalString(line.amount),
			loanId: line.loanId,
			advanceId: line.advanceId,
		}))
	);
}

async function linkOvertimeRecord(
	tx: Transaction,
	recordId: string,
	periodId: string,
	slipId: string
) {
	const [updated] = await tx
		.update(overtimeRecords)
		.set({
			payrollPeriodId: periodId,
			payrollSlipId: slipId,
			status: "paid",
		})
		.where(
			and(
				eq(overtimeRecords.id, recordId),
				eq(overtimeRecords.status, "approved"),
				isNull(overtimeRecords.payrollSlipId)
			)
		)
		.returning();

	if (!updated) {
		throw new Error("Overtime record could not be linked to the payroll slip.");
	}
}

async function processLoanRepaymentWithAmount(
	tx: Transaction,
	accountMappings: Record<string, number>,
	params: {
		loanId: string;
		amount: number;
		periodMonth: number;
		periodYear: number;
		payrollSlipId: string;
	}
) {
	if (params.amount <= 0) {
		return null;
	}

	const loan = await tx.query.employeeLoans.findFirst({
		where: eq(employeeLoans.id, params.loanId),
	});

	if (!loan) {
		throw new Error("Loan not found during payroll processing.");
	}

	if (loan.status !== LOAN_STATUS.ACTIVE) {
		throw new Error(`Loan ${loan.id} is not active for payroll repayment.`);
	}

	if (
		loan.outstandingBalance === null ||
		loan.repaymentStartMonth === null ||
		loan.repaymentStartYear === null
	) {
		throw new Error(`Loan ${loan.id} is missing repayment configuration.`);
	}

	const startIndex = getRepaymentPeriodIndex(loan.repaymentStartMonth, loan.repaymentStartYear);
	const targetIndex = getRepaymentPeriodIndex(params.periodMonth, params.periodYear);

	if (targetIndex < startIndex) {
		throw new Error(`Loan ${loan.id} is not due for this payroll period.`);
	}

	const existingRepayment = await tx.query.loanRepayments.findFirst({
		where: and(
			eq(loanRepayments.loanId, loan.id),
			eq(loanRepayments.periodMonth, params.periodMonth),
			eq(loanRepayments.periodYear, params.periodYear),
			eq(loanRepayments.isEarlySettlement, false)
		),
	});

	if (existingRepayment) {
		throw new Error(`Loan ${loan.id} already has a repayment for this period.`);
	}

	const breakdown = computeSingleInstalment(
		toNumber(loan.outstandingBalance),
		toNumber(loan.annualInterestRate),
		params.amount
	);
	const repaymentDate = todayIsoDate();

	const journalLinesForRepayment = [
		{
			accountId: accountMappings.loan_deductions_payable,
			amount: toPayrollDecimalString(breakdown.totalPayment),
			dc: "debit" as const,
			lineNumber: 1,
			memo: `Loan repayment ${loan.id}`,
		},
		{
			accountId: accountMappings.loans_receivable,
			amount: toPayrollDecimalString(breakdown.totalPayment),
			dc: "credit" as const,
			lineNumber: 2,
			memo: `Loan repayment ${loan.id}`,
		},
	];

	if (!areJournalValuesBalanced(journalLinesForRepayment)) {
		throw new Error("Loan repayment journal is not balanced.");
	}

	const journalEntryId = await createJournalEntry({
		entry: {
			description: `Loan repayment - ${loan.id} - period ${params.periodMonth}/${params.periodYear}`,
			entryDate: repaymentDate,
			reference: `LOAN-${loan.id}`,
			source: "loan_repayment",
			sourceId: loan.id,
		},
		lines: journalLinesForRepayment,
		tx,
	});

	const [created] = await tx
		.insert(loanRepayments)
		.values({
			loanId: loan.id,
			employeeId: loan.employeeId,
			repaymentDate,
			periodMonth: params.periodMonth,
			periodYear: params.periodYear,
			principalComponent: toPayrollDecimalString(breakdown.principalComponent),
			interestComponent: toPayrollDecimalString(breakdown.interestComponent),
			totalRepayment: toPayrollDecimalString(breakdown.totalPayment),
			balanceBefore: toPayrollDecimalString(loan.outstandingBalance),
			balanceAfter: toPayrollDecimalString(breakdown.balanceAfter),
			isEarlySettlement: false,
			payrollSlipId: params.payrollSlipId,
			journalEntryId,
		})
		.returning();

	await tx
		.update(employeeLoans)
		.set({
			outstandingBalance: toPayrollDecimalString(breakdown.balanceAfter),
			totalPrincipalPaid: toPayrollDecimalString(
				toNumber(loan.totalPrincipalPaid) + breakdown.principalComponent
			),
			totalInterestPaid: toPayrollDecimalString(
				toNumber(loan.totalInterestPaid) + breakdown.interestComponent
			),
			instalmentsPaid: loan.instalmentsPaid + 1,
			status: breakdown.balanceAfter <= 0 ? LOAN_STATUS.FULLY_PAID : LOAN_STATUS.ACTIVE,
			settledDate: breakdown.balanceAfter <= 0 ? repaymentDate : loan.settledDate,
		})
		.where(eq(employeeLoans.id, loan.id));

	return created;
}

async function processAdvanceRecoveryWithAmount(
	tx: Transaction,
	accountMappings: Record<string, number>,
	params: {
		advanceId: string;
		amount: number;
		periodMonth: number;
		periodYear: number;
		payrollSlipId: string;
	}
) {
	if (params.amount <= 0) {
		return null;
	}

	const advance = await tx.query.salaryAdvances.findFirst({
		where: eq(salaryAdvances.id, params.advanceId),
	});

	if (!advance) {
		throw new Error("Salary advance not found during payroll processing.");
	}

	if (
		advance.status !== SALARY_ADVANCE_STATUS.DISBURSED &&
		advance.status !== SALARY_ADVANCE_STATUS.RECOVERING
	) {
		throw new Error(`Salary advance ${advance.id} is not recoverable in payroll.`);
	}

	if (
		advance.outstandingBalance === null ||
		advance.recoveryStartMonth === null ||
		advance.recoveryStartYear === null
	) {
		throw new Error(`Salary advance ${advance.id} is missing recovery configuration.`);
	}

	const targetIndex = getRepaymentPeriodIndex(params.periodMonth, params.periodYear);
	const startIndex = getRepaymentPeriodIndex(advance.recoveryStartMonth, advance.recoveryStartYear);

	if (targetIndex < startIndex) {
		throw new Error(`Salary advance ${advance.id} is not due for this payroll period.`);
	}

	const existingRecovery = await tx.query.salaryAdvanceRecoveries.findFirst({
		where: and(
			eq(salaryAdvanceRecoveries.advanceId, advance.id),
			eq(salaryAdvanceRecoveries.periodMonth, params.periodMonth),
			eq(salaryAdvanceRecoveries.periodYear, params.periodYear)
		),
	});

	if (existingRecovery) {
		throw new Error(`Salary advance ${advance.id} already has a recovery for this period.`);
	}

	const recoveryAmount = roundPayrollAmount(
		Math.min(params.amount, toNumber(advance.outstandingBalance))
	);
	const balanceAfter = roundPayrollAmount(toNumber(advance.outstandingBalance) - recoveryAmount);
	const recoveryDate = todayIsoDate();
	const journalLines = [
		{
			accountId: accountMappings.salary_advance_payable,
			amount: toPayrollDecimalString(recoveryAmount),
			dc: "debit" as const,
			lineNumber: 1,
			memo: `Salary advance recovery ${advance.id}`,
		},
		{
			accountId: accountMappings.salary_advance_receivable,
			amount: toPayrollDecimalString(recoveryAmount),
			dc: "credit" as const,
			lineNumber: 2,
			memo: `Salary advance recovery ${advance.id}`,
		},
	];

	if (!areJournalValuesBalanced(journalLines)) {
		throw new Error("Salary advance recovery journal is not balanced.");
	}

	const journalEntryId = await createJournalEntry({
		entry: {
			description: `Salary advance recovery - ${advance.id} - period ${params.periodMonth}/${params.periodYear}`,
			entryDate: recoveryDate,
			reference: `ADVANCE-${advance.id}`,
			source: "salary_advance_recovery",
			sourceId: advance.id,
		},
		lines: journalLines,
		tx,
	});

	const [created] = await tx
		.insert(salaryAdvanceRecoveries)
		.values({
			advanceId: advance.id,
			employeeId: advance.employeeId,
			recoveryDate,
			periodMonth: params.periodMonth,
			periodYear: params.periodYear,
			recoveryAmount: toPayrollDecimalString(recoveryAmount),
			balanceBefore: toPayrollDecimalString(advance.outstandingBalance),
			balanceAfter: toPayrollDecimalString(balanceAfter),
			isLastRecovery: balanceAfter <= 0,
			payrollSlipId: params.payrollSlipId,
			clearingJournalEntryId: journalEntryId,
		})
		.returning();

	await tx
		.update(salaryAdvances)
		.set({
			outstandingBalance: toPayrollDecimalString(balanceAfter),
			recoveriesProcessed: advance.recoveriesProcessed + 1,
			totalRecovered: toPayrollDecimalString(toNumber(advance.totalRecovered) + recoveryAmount),
			status:
				balanceAfter <= 0
					? SALARY_ADVANCE_STATUS.FULLY_RECOVERED
					: SALARY_ADVANCE_STATUS.RECOVERING,
		})
		.where(eq(salaryAdvances.id, advance.id));

	return created;
}

// async function reverseAdvanceRecovery(tx: Transaction, recovery: SalaryAdvanceRecoveryRecord) {
// 	const advance = await tx.query.salaryAdvances.findFirst({
// 		where: eq(salaryAdvances.id, recovery.advanceId),
// 	});

// 	if (!advance) {
// 		throw new Error("Salary advance not found while reversing payroll slip.");
// 	}

// 	if (recovery.clearingJournalEntryId) {
// 		await tx
// 			.delete(journalLines)
// 			.where(eq(journalLines.journalEntryId, recovery.clearingJournalEntryId));
// 		await tx.delete(journalEntries).where(eq(journalEntries.id, recovery.clearingJournalEntryId));
// 	}

// 	await tx.delete(salaryAdvanceRecoveries).where(eq(salaryAdvanceRecoveries.id, recovery.id));
// 	await tx
// 		.update(salaryAdvances)
// 		.set({
// 			outstandingBalance: toPayrollDecimalString(recovery.balanceBefore),
// 			recoveriesProcessed: Math.max(advance.recoveriesProcessed - 1, 0),
// 			totalRecovered: toPayrollDecimalString(
// 				toNumber(advance.totalRecovered) - toNumber(recovery.recoveryAmount)
// 			),
// 			status:
// 				toNumber(recovery.balanceBefore) >=
// 				toNumber(advance.approvedAmount ?? advance.requestedAmount)
// 					? SALARY_ADVANCE_STATUS.DISBURSED
// 					: SALARY_ADVANCE_STATUS.RECOVERING,
// 		})
// 		.where(eq(salaryAdvances.id, advance.id));
// }

// async function reverseSlip(
// 	tx: Transaction,
// 	slip: PayrollSlipRecord,
// 	options?: {
// 		reason?: string | null;
// 		cancelledBy?: string | null;
// 	}
// ) {
// 	if (slip.status === "approved") {
// 		console.warn(`Reversing approved payroll slip ${slip.id}.`);
// 	}

// 	if (slip.overtimeRecordId) {
// 		await tx
// 			.update(overtimeRecords)
// 			.set({
// 				status: "approved",
// 				payrollSlipId: null,
// 			})
// 			.where(eq(overtimeRecords.id, slip.overtimeRecordId));
// 	}

// 	const [loanRows, advanceRows] = await Promise.all([
// 		tx.query.loanRepayments.findMany({
// 			where: eq(loanRepayments.payrollSlipId, slip.id),
// 		}),
// 		tx.query.salaryAdvanceRecoveries.findMany({
// 			where: eq(salaryAdvanceRecoveries.payrollSlipId, slip.id),
// 		}),
// 	]);

// 	for (const repayment of loanRows) {
// 		await reverseLoanRepayment(tx, repayment);
// 	}

// 	for (const recovery of advanceRows) {
// 		await reverseAdvanceRecovery(tx, recovery);
// 	}

// 	await tx.delete(payrollDeductions).where(eq(payrollDeductions.payrollSlipId, slip.id));
// 	await tx
// 		.update(payrollSlips)
// 		.set({
// 			status: "cancelled",
// 			cancelledBy: options?.cancelledBy ?? null,
// 			cancelledAt: new Date(),
// 			cancellationReason: normalizePayrollText(options?.reason ?? null),
// 		})
// 		.where(eq(payrollSlips.id, slip.id));
// }

async function recomputeExistingSlip(
	tx: Transaction,
	slip: PayrollSlipRecord,
	rates: ResolvedStatutoryRates
) {
	const employee = await tx.query.employees.findFirst({
		where: eq(employees.id, slip.employeeId),
	});
	const structure = await tx.query.salaryStructures.findFirst({
		where: eq(salaryStructures.id, slip.salaryStructureId),
	});
	const { map: bonusMap } = await getBonusMapForPeriod(slip.payrollPeriodId, tx);
	const { map: otherDeductionMap } = await getOtherDeductionMapForPeriod(slip.payrollPeriodId, tx);
	const period = await getPayrollPeriodRecord(slip.payrollPeriodId, tx);

	if (!employee || !structure || !period) {
		throw new Error("Slip recomputation context is incomplete.");
	}

	const holidayDates = await tx
		.select({ holidayDate: publicHolidays.holidayDate })
		.from(publicHolidays)
		.where(
			and(
				gte(publicHolidays.holidayDate, period.periodStart),
				lte(publicHolidays.holidayDate, period.periodEnd)
			)
		)
		.then((rows) => rows.map((row) => row.holidayDate));

	const prorationInfo = computeEmployeeProratedDays(
		employee.hireDate,
		employee.terminationDate,
		period.periodStart,
		period.periodEnd,
		holidayDates
	);
	const leaveImpactMap = buildLeaveImpactMap(
		await tx.query.leaveRequests.findMany({
			where: and(
				eq(leaveRequests.employeeId, slip.employeeId),
				eq(leaveRequests.status, "approved"),
				eq(leaveRequests.affectsPayroll, true),
				lte(leaveRequests.startDate, period.periodEnd),
				gte(leaveRequests.endDate, period.periodStart)
			),
		})
	);
	const overtimeRecord = slip.overtimeRecordId
		? await tx.query.overtimeRecords.findFirst({
				where: eq(overtimeRecords.id, slip.overtimeRecordId),
			})
		: null;
	const loans = await tx.query.loanRepayments.findMany({
		where: eq(loanRepayments.payrollSlipId, slip.id),
	});
	const advances = await tx.query.salaryAdvanceRecoveries.findMany({
		where: eq(salaryAdvanceRecoveries.payrollSlipId, slip.id),
	});
	const computation = buildSlipPayload(
		employee,
		structure,
		prorationInfo,
		overtimeRecord ?? null,
		leaveImpactMap.get(employee.id) ?? { unpaidLeaveDays: 0, halfPayLeaveDays: 0 },
		loans.map((repayment) => ({
			loanId: repayment.loanId,
			monthlyInstalment: toNumber(repayment.totalRepayment),
			description: `Loan repayment ${repayment.loanId}`,
		})),
		advances.map((recovery) => ({
			advanceId: recovery.advanceId,
			recoveryAmount: toNumber(recovery.recoveryAmount),
			description: `Salary advance recovery ${recovery.advanceId}`,
		})),
		bonusMap.get(employee.id) ?? [],
		otherDeductionMap.get(employee.id) ?? [],
		rates
	);

	if (!computation.success) {
		throw new Error(computation.error.message);
	}

	await tx.delete(payrollDeductions).where(eq(payrollDeductions.payrollSlipId, slip.id));
	await insertPayrollDeductions(
		tx,
		slip.id,
		slip.payrollPeriodId,
		slip.employeeId,
		computation.data.deductionLines
	);
	await tx
		.update(payrollSlips)
		.set({
			...toSlipInsertValues(computation.data.slip, slip.payrollPeriodId, slip.employeeId),
			approvedBy: null,
			approvedAt: null,
		})
		.where(eq(payrollSlips.id, slip.id));

	return computation.data;
}

async function assertPeriodCanBeProcessed(periodId: string): Promise<Result<PayrollPeriodRecord>> {
	const period = await getPayrollPeriodRecord(periodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	if (period.status !== PAYROLL_PERIOD_STATUS.DRAFT) {
		return failure({
			type: "ValidationError",
			message:
				period.status === PAYROLL_PERIOD_STATUS.PROCESSING
					? "This period has already been processed. To reprocess, cancel the period first, fix any issues, then create a new period and run payroll again."
					: `Only draft periods can be processed. This period is currently ${period.status}.`,
		});
	}

	const existingSlip = await db.query.payrollSlips.findFirst({
		where: eq(payrollSlips.payrollPeriodId, periodId),
	});

	if (existingSlip) {
		return failure({
			type: "ConflictError",
			message:
				"Orphaned payroll slip data found for this period. Please contact system support to clean up before reprocessing.",
		});
	}

	return success(period);
}

async function runPayrollCalculation(
	payrollPeriodId: string,
	triggeredBy: string
): Promise<PayrollRunResult> {
	void triggeredBy;
	const startedAt = Date.now();
	const periodResult = await assertPeriodCanBeProcessed(payrollPeriodId);

	if (!periodResult.success) {
		return {
			success: false,
			periodId: payrollPeriodId,
			error: periodResult.error.message,
			failedEmployeeId: null,
			failedEmployeeName: null,
			rollbackConfirmed: true,
		};
	}

	const period = periodResult.data;
	const mappingValidation = await validateAllMappingsExistFn();

	if (!mappingValidation.valid) {
		return {
			success: false,
			periodId: payrollPeriodId,
			error: mappingValidation.issues.join(" "),
			failedEmployeeId: null,
			failedEmployeeName: null,
			rollbackConfirmed: true,
		};
	}

	const accountMappingsResult = await getAccountMappingsAsMapFn();

	if (!accountMappingsResult.success) {
		return {
			success: false,
			periodId: payrollPeriodId,
			error: accountMappingsResult.error.message,
			failedEmployeeId: null,
			failedEmployeeName: null,
			rollbackConfirmed: true,
		};
	}

	const rates = await resolveStatutoryRates(new Date(`${period.periodEnd}T00:00:00.000Z`), db);
	const employeesForPeriod = await getEligibleEmployeesForPeriod(
		period.periodStart,
		period.periodEnd
	);

	if (employeesForPeriod.length === 0) {
		return {
			success: false,
			periodId: payrollPeriodId,
			error: "No eligible employees were found for this payroll period.",
			failedEmployeeId: null,
			failedEmployeeName: null,
			rollbackConfirmed: true,
		};
	}

	const structuresByEmployeeId = await getStructuresForEmployees(
		employeesForPeriod.map((employee) => employee.id),
		period.periodEnd
	);
	const employeesMissingStructures = employeesForPeriod.filter(
		(employee) => !structuresByEmployeeId.has(employee.id)
	);

	if (employeesMissingStructures.length > 0) {
		return {
			success: false,
			periodId: payrollPeriodId,
			error: `Missing salary structures for: ${employeesMissingStructures
				.map((employee) => getEmployeeDisplayName(employee))
				.join(", ")}.`,
			failedEmployeeId: employeesMissingStructures[0]?.id ?? null,
			failedEmployeeName: employeesMissingStructures[0]
				? getEmployeeDisplayName(employeesMissingStructures[0])
				: null,
			rollbackConfirmed: true,
		};
	}

	const [holidayDates, leaveRows, overtimeMap, loanMap, advanceMap, bonusData, otherDeductionData] =
		await Promise.all([
			getPublicHolidayDates(period),
			getLeaveRowsForPeriod(period),
			getOvertimeByEmployee(period),
			getLoanMapForPeriod(period),
			getAdvanceMapForPeriod(period),
			getBonusMapForPeriod(period.id),
			getOtherDeductionMapForPeriod(period.id),
		]);
	const leaveImpactMap = buildLeaveImpactMap(leaveRows);
	const totalWorkingDaysInPeriod = computeWorkingDaysInMonth(
		period.periodYear,
		period.periodMonth,
		holidayDates
	);
	const skippedEmployees: SkippedEmployee[] = [];
	const processingEmployees: Array<{
		employee: EmployeeRecord;
		structure: SalaryStructureRecord;
		prorationInfo: ReturnType<typeof computeEmployeeProratedDays>;
	}> = [];

	for (const employee of employeesForPeriod) {
		const prorationInfo = computeEmployeeProratedDays(
			employee.hireDate,
			employee.terminationDate,
			period.periodStart,
			period.periodEnd,
			holidayDates
		);

		if (prorationInfo.proratedDays < PRORATION_MINIMUM_DAYS) {
			skippedEmployees.push({
				employeeId: employee.id,
				employeeName: getEmployeeDisplayName(employee),
				reason: "Employee had no working days in this period",
			});
			continue;
		}

		// Recompute the factor using the period-level totalWorkingDays so that
		// proratedFactor = proratedDays / totalWorkingDays holds as an invariant.
		const proratedFactor =
			totalWorkingDaysInPeriod > 0 ? prorationInfo.proratedDays / totalWorkingDaysInPeriod : 0;
		processingEmployees.push({
			employee,
			structure: structuresByEmployeeId.get(employee.id) as SalaryStructureRecord,
			prorationInfo: {
				...prorationInfo,
				totalWorkingDays: totalWorkingDaysInPeriod,
				proratedFactor,
			},
		});
	}

	if (processingEmployees.length === 0) {
		return {
			success: false,
			periodId: payrollPeriodId,
			error: "No employees qualified for payroll after proration checks.",
			failedEmployeeId: null,
			failedEmployeeName: null,
			rollbackConfirmed: true,
		};
	}

	try {
		const transactionResult = await db.transaction(async (tx) => {
			const warnings: SlipWarning[] = [];
			const slipSummaries: PayrollRunSuccess["slipSummaries"] = [];
			const processingStartedAt = new Date();

			for (const item of processingEmployees) {
				const computation = buildSlipPayload(
					item.employee,
					item.structure,
					item.prorationInfo,
					overtimeMap.get(item.employee.id) ?? null,
					leaveImpactMap.get(item.employee.id) ?? {
						unpaidLeaveDays: 0,
						halfPayLeaveDays: 0,
					},
					loanMap.get(item.employee.id) ?? [],
					advanceMap.get(item.employee.id) ?? [],
					bonusData.map.get(item.employee.id) ?? [],
					otherDeductionData.map.get(item.employee.id) ?? [],
					rates
				);

				if (!computation.success) {
					const error = new Error(computation.error.message) as Error & {
						employeeId?: string;
						employeeName?: string;
					};
					error.employeeId = item.employee.id;
					error.employeeName = getEmployeeDisplayName(item.employee);
					throw error;
				}

				const [slip] = await tx
					.insert(payrollSlips)
					.values(toSlipInsertValues(computation.data.slip, period.id, item.employee.id))
					.returning();

				await insertPayrollDeductions(
					tx,
					slip.id,
					period.id,
					item.employee.id,
					computation.data.deductionLines
				);

				if (computation.data.slip.overtimeRecordId) {
					await linkOvertimeRecord(tx, computation.data.slip.overtimeRecordId, period.id, slip.id);
				}

				for (const loan of computation.data.loanDeductions) {
					await processLoanRepaymentWithAmount(tx, accountMappingsResult.data, {
						loanId: loan.loanId,
						amount: loan.appliedAmount,
						periodMonth: period.periodMonth,
						periodYear: period.periodYear,
						payrollSlipId: slip.id,
					});
				}

				for (const advance of computation.data.advanceRecoveries) {
					await processAdvanceRecoveryWithAmount(tx, accountMappingsResult.data, {
						advanceId: advance.advanceId,
						amount: advance.appliedAmount,
						periodMonth: period.periodMonth,
						periodYear: period.periodYear,
						payrollSlipId: slip.id,
					});
				}

				for (const warning of computation.data.warnings) {
					warnings.push({
						employeeId: item.employee.id,
						employeeName: getEmployeeDisplayName(item.employee),
						message: warning,
					});
				}

				slipSummaries.push({
					employeeId: item.employee.id,
					employeeName: getEmployeeDisplayName(item.employee),
					grossPay: computation.data.slip.grossPay,
					fullMonthGrossPay: computation.data.slip.fullMonthGrossPay,
					isProrated: computation.data.slip.isProrated,
					proratedDays: computation.data.slip.proratedDays,
					totalWorkingDays: computation.data.slip.totalWorkingDaysInPeriod,
					totalDeductions: computation.data.slip.totalDeductions,
					netPay: computation.data.slip.netPay,
					twoThirdsCapApplied: computation.data.slip.twoThirdsCapApplied,
				});
			}

			const { totals } = await updatePayrollPeriodAggregates(period.id, tx, {
				processingWarnings: warnings,
				skippedEmployees,
				status: PAYROLL_PERIOD_STATUS.PROCESSING,
				processingStartedAt,
				processingCompletedAt: new Date(),
			});

			return {
				warnings,
				slipSummaries,
				totals,
			};
		});

		return {
			success: true,
			periodId: period.id,
			periodName: period.name,
			employeesProcessed: processingEmployees.length,
			employeesSkipped: skippedEmployees.length,
			processingDurationMs: Date.now() - startedAt,
			totals: {
				grossPay: transactionResult.totals.totalGrossPay,
				netPay: transactionResult.totals.totalNetPay,
				totalPaye: transactionResult.totals.totalPaye,
				totalNssfEmployee: transactionResult.totals.totalNssfEmployee,
				totalNssfEmployer: transactionResult.totals.totalNssfEmployer,
				totalShifEmployee: transactionResult.totals.totalShifEmployee,
				totalShifEmployer: transactionResult.totals.totalShifEmployer,
				totalAhlEmployee: transactionResult.totals.totalAhlEmployee,
				totalAhlEmployer: transactionResult.totals.totalAhlEmployer,
				totalNita: transactionResult.totals.totalNita,
				totalLoanDeductions: transactionResult.totals.totalLoanDeductions,
				totalAdvanceRecoveries: transactionResult.totals.totalAdvanceRecoveries,
				totalOtherDeductions: transactionResult.totals.totalOtherDeductions,
				totalEmployerCost: transactionResult.totals.totalEmployerCost,
			},
			warnings: transactionResult.warnings,
			skippedEmployees,
			slipSummaries: transactionResult.slipSummaries,
		};
	} catch (error) {
		const typedError = error as Error & {
			employeeId?: string;
			employeeName?: string;
		};
		return {
			success: false,
			periodId: payrollPeriodId,
			error: typedError.message,
			failedEmployeeId: typedError.employeeId ?? null,
			failedEmployeeName: typedError.employeeName ?? null,
			rollbackConfirmed: true,
		};
	}
}

async function getPayrollSlipById(slipId: string): Promise<Result<PayrollSlipDetailView>> {
	const row = await db
		.select({
			slip: payrollSlips,
			employeeNo: employees.employeeNo,
			employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			departmentName: departments.name,
		})
		.from(payrollSlips)
		.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(eq(payrollSlips.id, slipId))
		.then((rows) => rows[0] ?? null);

	if (!row) {
		return failure({
			type: "NotFoundError",
			message: "Payroll slip not found.",
		});
	}

	const deductions = await db.query.payrollDeductions.findMany({
		where: eq(payrollDeductions.payrollSlipId, slipId),
		orderBy: [asc(payrollDeductions.createdAt)],
	});

	return success({
		...mapSlipRecord(row.slip),
		employeeName: row.employeeName,
		employeeNo: row.employeeNo,
		departmentName: row.departmentName,
		deductions: deductions.map(mapDeductionRecord),
	});
}

async function getPayrollSlipsForPeriod(filters: z.infer<typeof payrollSlipPeriodSearchSchema>) {
	const conditions = [eq(payrollSlips.payrollPeriodId, filters.payrollPeriodId)];

	if (filters.status) {
		conditions.push(eq(payrollSlips.status, filters.status));
	}

	if (filters.departmentId) {
		conditions.push(eq(employees.departmentId, filters.departmentId));
	}

	const rows = await db
		.select({
			slip: payrollSlips,
			employeeNo: employees.employeeNo,
			employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			departmentId: employees.departmentId,
			departmentName: departments.name,
		})
		.from(payrollSlips)
		.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(and(...conditions))
		.orderBy(asc(employees.lastName), asc(employees.firstName));

	return rows.map((row) => ({
		...mapSlipRecord(row.slip),
		employeeNo: row.employeeNo,
		employeeName: row.employeeName,
		departmentId: row.departmentId,
		departmentName: row.departmentName,
	})) satisfies PayrollSlipListItem[];
}

async function getPayrollSlipForEmployee(params: z.infer<typeof payrollSlipForEmployeeSchema>) {
	const row = await db.query.payrollSlips.findFirst({
		where: and(
			eq(payrollSlips.employeeId, params.employeeId),
			eq(payrollSlips.payrollPeriodId, params.payrollPeriodId)
		),
	});

	return row ? mapSlipRecord(row) : null;
}

async function getEmployeePayrollHistory(params: z.infer<typeof employeePayrollHistorySchema>) {
	const conditions = [eq(payrollSlips.employeeId, params.employeeId)];

	if (params.fromYear !== undefined) {
		conditions.push(gte(payrollPeriods.periodYear, params.fromYear));
	}

	if (params.toYear !== undefined) {
		conditions.push(lte(payrollPeriods.periodYear, params.toYear));
	}

	const rows = await db
		.select({
			slip: payrollSlips,
			periodId: payrollPeriods.id,
			periodName: payrollPeriods.name,
			periodMonth: payrollPeriods.periodMonth,
			periodYear: payrollPeriods.periodYear,
		})
		.from(payrollSlips)
		.innerJoin(payrollPeriods, eq(payrollSlips.payrollPeriodId, payrollPeriods.id))
		.where(and(...conditions))
		.orderBy(desc(payrollPeriods.periodYear), desc(payrollPeriods.periodMonth));

	return rows.map((row) => ({
		slipId: row.slip.id,
		periodId: row.periodId,
		periodName: row.periodName,
		periodMonth: row.periodMonth,
		periodYear: row.periodYear,
		grossPay: toNumber(row.slip.grossPay),
		fullMonthGrossPay: toNumber(row.slip.fullMonthGrossPay),
		isProrated: row.slip.isProrated,
		netPay: toNumber(row.slip.netPay),
		totalPaye: toNumber(row.slip.netPaye),
		totalNssf: sumValues([toNumber(row.slip.nssfEmployee), toNumber(row.slip.nssfEmployer)]),
		status: row.slip.status,
	})) satisfies EmployeePayrollHistoryItem[];
}

async function getPayrollSummaryByDepartment(
	params: z.infer<typeof payrollDepartmentSummarySchema>
) {
	const rows = await db
		.select({
			departmentId: employees.departmentId,
			departmentName: departments.name,
			grossPay: payrollSlips.grossPay,
			netPay: payrollSlips.netPay,
			totalEmployerCost: payrollSlips.totalEmployerCost,
			isProrated: payrollSlips.isProrated,
		})
		.from(payrollSlips)
		.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(
			and(
				eq(payrollSlips.payrollPeriodId, params.payrollPeriodId),
				ne(payrollSlips.status, "cancelled")
			)
		);

	const grouped = new Map<string, DepartmentPayrollSummaryItem>();

	for (const row of rows) {
		const key = getDepartmentKey(row.departmentId);
		const existing = grouped.get(key) ?? {
			departmentId: row.departmentId,
			departmentName: row.departmentName,
			employeeCount: 0,
			proratedEmployeeCount: 0,
			totalGrossPay: 0,
			totalNetPay: 0,
			totalEmployerCost: 0,
		};

		existing.employeeCount += 1;
		existing.proratedEmployeeCount += row.isProrated ? 1 : 0;
		existing.totalGrossPay = sumValues([existing.totalGrossPay, toNumber(row.grossPay)]);
		existing.totalNetPay = sumValues([existing.totalNetPay, toNumber(row.netPay)]);
		existing.totalEmployerCost = sumValues([
			existing.totalEmployerCost,
			toNumber(row.totalEmployerCost),
		]);
		grouped.set(key, existing);
	}

	return Array.from(grouped.values()).sort((left, right) =>
		(left.departmentName ?? "Unassigned").localeCompare(right.departmentName ?? "Unassigned")
	);
}

async function approvePayrollSlip(
	slipId: string,
	approvedBy: string
): Promise<Result<ReturnType<typeof mapSlipRecord>>> {
	const slip = await db.query.payrollSlips.findFirst({
		where: eq(payrollSlips.id, slipId),
	});

	if (!slip) {
		return failure({
			type: "NotFoundError",
			message: "Payroll slip not found.",
		});
	}

	const period = await getPayrollPeriodRecord(slip.payrollPeriodId);

	if (!period || period.status !== PAYROLL_PERIOD_STATUS.PROCESSING) {
		return failure({
			type: "ValidationError",
			message: "Payroll slips can only be approved while the period is in processing status.",
		});
	}

	if (slip.status !== "draft") {
		return failure({
			type: "ValidationError",
			message: `Only draft slips can be approved. This slip is ${slip.status}.`,
		});
	}

	const [updated] = await db
		.update(payrollSlips)
		.set({
			status: "approved",
			approvedBy,
			approvedAt: new Date(),
		})
		.where(eq(payrollSlips.id, slipId))
		.returning();

	return success(mapSlipRecord(updated));
}

async function cancelPayrollSlip(
	slipId: string,
	cancelledBy: string,
	reason: string
): Promise<Result<ReturnType<typeof mapSlipRecord>>> {
	const slip = await db.query.payrollSlips.findFirst({
		where: eq(payrollSlips.id, slipId),
	});

	if (!slip) {
		return failure({
			type: "NotFoundError",
			message: "Payroll slip not found.",
		});
	}

	const period = await getPayrollPeriodRecord(slip.payrollPeriodId);

	if (!period || period.status !== PAYROLL_PERIOD_STATUS.PROCESSING) {
		return failure({
			type: "ValidationError",
			message: "Payroll slips can only be cancelled while the period is in processing status.",
		});
	}

	if (slip.status === "cancelled") {
		return failure({
			type: "ConflictError",
			message: "This payroll slip has already been cancelled.",
		});
	}

	const updatedSlip = await db.transaction(async (tx) => {
		await reverseSlip(tx, slip, {
			reason,
			cancelledBy,
		});
		await updatePayrollPeriodAggregates(period.id, tx);

		return tx.query.payrollSlips.findFirst({
			where: eq(payrollSlips.id, slip.id),
		});
	});

	return success(mapSlipRecord(updatedSlip as PayrollSlipRecord));
}

async function addBonusToSlip(
	params: z.infer<typeof payrollSlipBonusSchema>,
	addedBy: string
): Promise<Result<ReturnType<typeof mapSlipRecord>>> {
	const slip = await db.query.payrollSlips.findFirst({
		where: eq(payrollSlips.id, params.slipId),
	});

	if (!slip) {
		return failure({
			type: "NotFoundError",
			message: "Payroll slip not found.",
		});
	}

	const period = await getPayrollPeriodRecord(slip.payrollPeriodId);

	if (!period || period.status !== PAYROLL_PERIOD_STATUS.PROCESSING) {
		return failure({
			type: "ValidationError",
			message: "Bonuses can only be added while the payroll period is in processing status.",
		});
	}

	try {
		const updated = await db.transaction(async (tx) => {
			await tx.insert(payrollPeriodBonuses).values({
				payrollPeriodId: slip.payrollPeriodId,
				employeeId: slip.employeeId,
				amount: toPayrollDecimalString(params.bonusAmount),
				description: params.description,
				notes: normalizePayrollText(params.notes),
				createdBy: addedBy,
			});

			await recomputeExistingSlip(
				tx,
				slip,
				await resolveStatutoryRates(new Date(`${period.periodEnd}T00:00:00.000Z`), tx)
			);
			await updatePayrollPeriodAggregates(period.id, tx);

			return tx.query.payrollSlips.findFirst({
				where: eq(payrollSlips.id, slip.id),
			});
		});

		return success(mapSlipRecord(updated as PayrollSlipRecord));
	} catch (error) {
		return failure({
			type: "ApplicationError",
			message: error instanceof Error ? error.message : "Failed to add bonus to payroll slip.",
		});
	}
}

async function getPayrollPeriodAdjustmentOptions(
	params: z.infer<typeof payrollPeriodAdjustmentOptionsSchema>
) {
	const period = await getPayrollPeriodRecord(params.payrollPeriodId);

	if (!period) {
		throw new Error("Payroll period not found.");
	}

	const [employeesForPeriod, bonusRows, otherDeductionRows] = await Promise.all([
		getEligibleEmployeesForPeriod(period.periodStart, period.periodEnd),
		db
			.select({
				id: payrollPeriodBonuses.id,
				employeeId: payrollPeriodBonuses.employeeId,
				employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				amount: payrollPeriodBonuses.amount,
				description: payrollPeriodBonuses.description,
				notes: payrollPeriodBonuses.notes,
			})
			.from(payrollPeriodBonuses)
			.innerJoin(employees, eq(payrollPeriodBonuses.employeeId, employees.id))
			.where(eq(payrollPeriodBonuses.payrollPeriodId, params.payrollPeriodId)),
		db
			.select({
				id: payrollPeriodOtherDeductions.id,
				employeeId: payrollPeriodOtherDeductions.employeeId,
				employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				deductionType: payrollPeriodOtherDeductions.deductionType,
				amount: payrollPeriodOtherDeductions.amount,
				description: payrollPeriodOtherDeductions.description,
				notes: payrollPeriodOtherDeductions.notes,
			})
			.from(payrollPeriodOtherDeductions)
			.innerJoin(employees, eq(payrollPeriodOtherDeductions.employeeId, employees.id))
			.where(eq(payrollPeriodOtherDeductions.payrollPeriodId, params.payrollPeriodId)),
	]);

	const departmentRows =
		employeesForPeriod.length > 0
			? await db.query.departments.findMany({
					where: inArray(
						departments.id,
						employeesForPeriod
							.map((employee) => employee.departmentId)
							.filter((value): value is number => value !== null)
					),
				})
			: [];
	const departmentMap = new Map(departmentRows.map((row) => [row.id, row.name]));

	return {
		employees: employeesForPeriod.map((employee) => ({
			id: employee.id,
			employeeNo: employee.employeeNo,
			fullName: getEmployeeDisplayName(employee),
			departmentId: employee.departmentId,
			departmentName:
				employee.departmentId === null ? null : (departmentMap.get(employee.departmentId) ?? null),
		})),
		bonuses: bonusRows.map((row) => ({
			...row,
			amount: toNumber(row.amount),
		})),
		otherDeductions: otherDeductionRows.map((row) => ({
			...row,
			amount: toNumber(row.amount),
		})),
	} satisfies PayrollAdjustmentOptions;
}

async function addPayrollPeriodBonus(payload: BonusFormValues, createdBy: string) {
	const period = await getPayrollPeriodRecord(payload.periodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	if (period.status !== PAYROLL_PERIOD_STATUS.DRAFT) {
		return failure({
			type: "ValidationError",
			message: "Payroll period must be in draft status.",
		});
	}

	const employeeAdded = await db.query.payrollPeriodBonuses.findMany({
		where: and(
			eq(payrollPeriodBonuses.payrollPeriodId, payload.periodId),
			inArray(
				payrollPeriodBonuses.employeeId,
				payload.employees.map((e) => e.employeeId)
			)
		),
	});

	if (employeeAdded.length > 0) {
		return failure({
			type: "ConflictError",
			message: "Some bonuses have already been added to this payroll period.",
		});
	}

	await db.insert(payrollPeriodBonuses).values(
		payload.employees.map((e) => ({
			payrollPeriodId: payload.periodId,
			employeeId: e.employeeId,
			amount: toPayrollDecimalString(e.amount),
			description: e.description,
			createdBy,
		}))
	);

	return success(undefined);
}

async function addPayrollPeriodOtherDeduction(payload: DeductionFormValues, createdBy: string) {
	const period = await getPayrollPeriodRecord(payload.payrollPeriodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	if (period.status !== PAYROLL_PERIOD_STATUS.DRAFT) {
		return failure({
			type: "ValidationError",
			message: "Payroll period must be in draft status.",
		});
	}

	const employeeAdded = await db.query.payrollPeriodOtherDeductions.findMany({
		where: and(
			eq(payrollPeriodOtherDeductions.payrollPeriodId, payload.payrollPeriodId),
			inArray(
				payrollPeriodOtherDeductions.employeeId,
				payload.deductions.map((e) => e.employeeId)
			)
		),
	});

	if (employeeAdded.length > 0) {
		return failure({
			type: "ConflictError",
			message: "Some deductions have already been added to this payroll period.",
		});
	}

	await db.insert(payrollPeriodOtherDeductions).values(
		payload.deductions.map((e) => ({
			payrollPeriodId: payload.payrollPeriodId,
			employeeId: e.employeeId,
			deductionType: e.deductionType,
			amount: toPayrollDecimalString(e.amount),
			description: e.description,
			createdBy,
		}))
	);

	return success(undefined);
}

async function requirePayrollSlipViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:view");
}

async function requirePayrollProcessAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-process:create");
}

export const getPayrollSlipByIdFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollSlipIdSchema)
	.handler(async ({ data }) => {
		await requirePayrollSlipViewAccess();
		const result = await getPayrollSlipById(data.slipId);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		return result.data;
	});

export const getPayrollSlipsForPeriodFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollSlipPeriodSearchSchema)
	.handler(async ({ data }) => {
		await requirePayrollSlipViewAccess();
		return getPayrollSlipsForPeriod(data);
	});

export const getPayrollSlipForEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollSlipForEmployeeSchema)
	.handler(async ({ data }) => {
		await requirePayrollSlipViewAccess();
		return getPayrollSlipForEmployee(data);
	});

export const getEmployeePayrollHistoryFn = createServerFn()
	.middleware([authMiddleware])
	.validator(employeePayrollHistorySchema)
	.handler(async ({ data }) => {
		await requirePayrollSlipViewAccess();
		return getEmployeePayrollHistory(data);
	});

export const getPayrollSummaryByDepartmentFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollDepartmentSummarySchema)
	.handler(async ({ data }) => {
		await requirePayrollSlipViewAccess();
		return getPayrollSummaryByDepartment(data);
	});

export const getPayrollAdjustmentOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodAdjustmentOptionsSchema)
	.handler(async ({ data }) => {
		await requirePayrollSlipViewAccess();
		return getPayrollPeriodAdjustmentOptions(data);
	});

export const approvePayrollSlipFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollSlipIdSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollProcessAccess();
		return approvePayrollSlip(data.slipId, context.user.id);
	});

export const cancelPayrollSlipFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollSlipCancelSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollProcessAccess();
		return cancelPayrollSlip(data.slipId, context.user.id, data.reason);
	});

export const getPayrollPeriodBonusesFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodIdSchema)
	.handler(async ({ data }) => {
		await requirePermission("payroll-periods:create");
		const bonuses = await db.query.payrollPeriodBonuses.findMany({
			columns: { id: true, amount: true, description: true, employeeId: true },
			where: eq(payrollPeriodBonuses.payrollPeriodId, data.periodId),
			with: {
				employee: { columns: { firstName: true, lastName: true } },
			},
		});
		return bonuses.map((b) => ({
			id: b.id,
			employeeId: b.employeeId,
			description: b.description,
			amount: toNumber(b.amount),
			employeeName: `${b.employee.firstName} ${b.employee.lastName}`,
		}));
	});

export const getPayrollPeriodOtherDeductionsFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollPeriodIdSchema)
	.handler(async ({ data }) => {
		await requirePermission("payroll-periods:create");
		const otherDeductions = await db.query.payrollPeriodOtherDeductions.findMany({
			where: eq(payrollPeriodOtherDeductions.payrollPeriodId, data.periodId),
			with: {
				employee: { columns: { firstName: true, lastName: true } },
			},
		});
		return otherDeductions;
	});

export const addBonusToSlipFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollSlipBonusSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollProcessAccess();
		return addBonusToSlip(data, context.user.id);
	});

export const addPayrollPeriodBonusFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(bonusFormSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollProcessAccess();
		return addPayrollPeriodBonus(data, context.user.id);
	});

export const addPayrollPeriodOtherDeductionFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(payrollPeriodOtherDeductionCreateSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollProcessAccess();
		return addPayrollPeriodOtherDeduction(data, context.user.id);
	});

export const runPayrollCalculationFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			periodId: requiredStringNonLowerSchemaEntry("Period id is required"),
		})
	)
	.handler(
		async ({
			data: { periodId },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePayrollProcessAccess();
			return await runPayrollCalculation(periodId, userId);
		}
	);

export const updatePayrollPeriodAggregatesFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(
		z.object({
			periodId: requiredStringNonLowerSchemaEntry("Period id is required"),
			processingCompletedAt: z.coerce.date().nullable(),
		})
	)
	.handler(async ({ data }) => {
		await requirePayrollProcessAccess();
		return updatePayrollPeriodAggregates(data.periodId, db, {
			processingCompletedAt: data.processingCompletedAt
				? new Date(data.processingCompletedAt)
				: data.processingCompletedAt, // preserves null
		});
	});

export type PayrollSlipDetailResponse = Awaited<ReturnType<typeof getPayrollSlipByIdFn>>;
export type PayrollSlipPeriodItem = Awaited<ReturnType<typeof getPayrollSlipsForPeriodFn>>[number];
export type PayrollEmployeeHistoryResponse = Awaited<
	ReturnType<typeof getEmployeePayrollHistoryFn>
>[number];
export type PayrollDepartmentSummaryResponse = Awaited<
	ReturnType<typeof getPayrollSummaryByDepartmentFn>
>[number];
export type PayrollAdjustmentOptionsResponse = Awaited<
	ReturnType<typeof getPayrollAdjustmentOptionsFn>
>;
