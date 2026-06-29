import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { departments, employees, overtimeRecords, users } from "@/drizzle/schema";
import {
	computeOvertimePay,
	getCurrentPeriodParts,
	getMonthBoundaryDate,
	getPeriodIndex,
	isFuturePayrollPeriod,
} from "@/features/payroll/lib/helpers";
import {
	OVERTIME_MAX_HOURS_PER_FORTNIGHT,
	OVERTIME_STATUS,
} from "@/features/payroll/lib/payroll-constants";
import {
	overtimePayrollLinkSchema,
	overtimeRecordByEmployeePeriodSchema,
	overtimeRecordByIdSchema,
	overtimeRecordCreateRequestSchema,
	overtimeRecordDeleteSchema,
	overtimeRecordPeriodSchema,
	overtimeRecordPeriodSearchSchema,
	overtimeRecordStatusActionSchema,
	overtimeRecordUpdateRequestSchema,
	overtimeSummaryRangeSchema,
	type OvertimeRecordCreateFormInput,
	type OvertimeRecordUpdatePayload,
} from "@/features/payroll/services/overtime.schemas";
import { getActiveStructureForPeriodFn } from "@/features/payroll/services/salary-structures.api";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { toTitleCase } from "@/lib/utils";
import { roundDecimal, toBig, toDecimalString } from "@/lib/helpers";
import {
	employeeSearchCondition,
	getEligibleEmployee,
} from "@/features/employees/services/employee.server";

type OvertimeRecordRow = typeof overtimeRecords.$inferSelect;
type OvertimeCreatePayload = z.infer<typeof overtimeRecordCreateRequestSchema>;
type OvertimePeriodFilters = z.infer<typeof overtimeRecordPeriodSearchSchema>;
type OvertimeRecordNumericFields = {
	weekdayOvertimeHours: number;
	weekendOvertimeHours: number;
	publicHolidayOvertimeHours: number;
	overtimeHourlyRate: number;
	weekdayOvertimePay: number;
	weekendOvertimePay: number;
	publicHolidayOvertimePay: number;
	totalOvertimePay: number;
};

type OvertimeRecordView = Omit<OvertimeRecordRow, keyof OvertimeRecordNumericFields> &
	OvertimeRecordNumericFields;

type OvertimeMutationResponse = {
	record: OvertimeRecordView;
	warnings: string[];
};

type OvertimeRecordListItem = OvertimeRecordView & {
	employeeNo: string;
	firstName: string;
	lastName: string;
	fullName: string;
	departmentId: number | null;
	departmentName: string | null;
};

type OvertimeDetailView = OvertimeRecordListItem & {
	approvedByName: string | null;
	createdByName: string | null;
};

type OvertimeFormOptions = {
	employees: Array<{
		id: string;
		employeeNo: string;
		fullName: string;
	}>;
	departments: Array<{
		id: number;
		name: string;
	}>;
};

type OvertimeSummaryResponse = {
	employeeId: string;
	totals: {
		weekdayOvertimeHours: number;
		weekendOvertimeHours: number;
		publicHolidayOvertimeHours: number;
		totalOvertimeHours: number;
		totalOvertimePay: number;
	};
	records: Array<OvertimeRecordView>;
};

const OVERTIME_WARNING_MESSAGE =
	"Total overtime hours entered may exceed statutory limits. Please verify against actual fortnight records.";

function mapOvertimeRecord(record: OvertimeRecordRow): OvertimeRecordView {
	return {
		...record,
		weekdayOvertimeHours: roundDecimal(record.weekdayOvertimeHours),
		weekendOvertimeHours: roundDecimal(record.weekendOvertimeHours),
		publicHolidayOvertimeHours: roundDecimal(record.publicHolidayOvertimeHours),
		overtimeHourlyRate: roundDecimal(record.overtimeHourlyRate),
		weekdayOvertimePay: roundDecimal(record.weekdayOvertimePay),
		weekendOvertimePay: roundDecimal(record.weekendOvertimePay),
		publicHolidayOvertimePay: roundDecimal(record.publicHolidayOvertimePay),
		totalOvertimePay: roundDecimal(record.totalOvertimePay),
	};
}

function mapOvertimeListRow(row: {
	id: string;
	employeeId: string;
	payrollPeriodId: string | null;
	periodMonth: number;
	periodYear: number;
	weekdayOvertimeHours: string;
	weekendOvertimeHours: string;
	publicHolidayOvertimeHours: string;
	overtimeHourlyRate: string;
	weekdayOvertimePay: string;
	weekendOvertimePay: string;
	publicHolidayOvertimePay: string;
	totalOvertimePay: string;
	status: OvertimeRecordRow["status"];
	approvedBy: string | null;
	approvedAt: Date | null;
	payrollSlipId: string | null;
	notes: string | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
	employeeNo: string;
	firstName: string;
	lastName: string;
	fullName: string;
	departmentId: number | null;
	departmentName: string | null;
}): OvertimeRecordListItem {
	return {
		id: row.id,
		employeeId: row.employeeId,
		payrollPeriodId: row.payrollPeriodId,
		periodMonth: row.periodMonth,
		periodYear: row.periodYear,
		weekdayOvertimeHours: roundDecimal(row.weekdayOvertimeHours),
		weekendOvertimeHours: roundDecimal(row.weekendOvertimeHours),
		publicHolidayOvertimeHours: roundDecimal(row.publicHolidayOvertimeHours),
		overtimeHourlyRate: roundDecimal(row.overtimeHourlyRate),
		weekdayOvertimePay: roundDecimal(row.weekdayOvertimePay),
		weekendOvertimePay: roundDecimal(row.weekendOvertimePay),
		publicHolidayOvertimePay: roundDecimal(row.publicHolidayOvertimePay),
		totalOvertimePay: roundDecimal(row.totalOvertimePay),
		status: row.status,
		approvedBy: row.approvedBy,
		approvedAt: row.approvedAt,
		payrollSlipId: row.payrollSlipId,
		notes: row.notes,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		employeeNo: row.employeeNo,
		firstName: row.firstName,
		lastName: row.lastName,
		fullName: row.fullName,
		departmentId: row.departmentId,
		departmentName: row.departmentName,
	};
}

function parseHourValues(payload: {
	weekdayOvertimeHours: number | string;
	weekendOvertimeHours: number | string;
	publicHolidayOvertimeHours: number | string;
}) {
	return {
		weekdayOvertimeHours: roundDecimal(payload.weekdayOvertimeHours),
		weekendOvertimeHours: roundDecimal(payload.weekendOvertimeHours),
		publicHolidayOvertimeHours: roundDecimal(payload.publicHolidayOvertimeHours),
	};
}

function validateHourValues(payload: {
	weekdayOvertimeHours: number;
	weekendOvertimeHours: number;
	publicHolidayOvertimeHours: number;
}): Result<{
	weekdayOvertimeHours: number;
	weekendOvertimeHours: number;
	publicHolidayOvertimeHours: number;
	totalOvertimeHours: number;
	warnings: string[];
}> {
	if (
		payload.weekdayOvertimeHours < 0 ||
		payload.weekendOvertimeHours < 0 ||
		payload.publicHolidayOvertimeHours < 0
	) {
		return failure({
			type: "ValidationError",
			message: "Overtime hours must be zero or greater",
		});
	}

	const totalOvertimeHours = roundDecimal(
		toBig(payload.weekdayOvertimeHours)
			.plus(payload.weekendOvertimeHours)
			.plus(payload.publicHolidayOvertimeHours)
	);

	if (totalOvertimeHours <= 0) {
		return failure({
			type: "ValidationError",
			message: "At least one overtime hour value must be greater than zero",
		});
	}

	const warnings: string[] = [];

	if (totalOvertimeHours > OVERTIME_MAX_HOURS_PER_FORTNIGHT / 2) {
		warnings.push(OVERTIME_WARNING_MESSAGE);
	}

	return success({
		...payload,
		totalOvertimeHours,
		warnings,
	});
}

async function getExistingOvertimeRecordForPeriod(
	employeeId: string,
	periodYear: number,
	periodMonth: number
) {
	return db.query.overtimeRecords.findFirst({
		where: and(
			eq(overtimeRecords.employeeId, employeeId),
			eq(overtimeRecords.periodYear, periodYear),
			eq(overtimeRecords.periodMonth, periodMonth)
		),
	});
}

async function getOvertimeRecordById(recordId: string) {
	return db.query.overtimeRecords.findFirst({
		where: eq(overtimeRecords.id, recordId),
	});
}

async function resolveOvertimeComputation({
	employeeId,
	periodMonth,
	periodYear,
	weekdayOvertimeHours,
	weekendOvertimeHours,
	publicHolidayOvertimeHours,
}: {
	employeeId: string;
	periodMonth: number;
	periodYear: number;
	weekdayOvertimeHours: number;
	weekendOvertimeHours: number;
	publicHolidayOvertimeHours: number;
}): Promise<
	Result<{
		overtimeHourlyRate: number;
		weekdayOvertimePay: number;
		weekendOvertimePay: number;
		publicHolidayOvertimePay: number;
		totalOvertimePay: number;
	}>
> {
	const periodEndDate = getMonthBoundaryDate(periodYear, periodMonth, "end");
	const salaryStructureResult = await getActiveStructureForPeriodFn({
		data: { employeeId, periodDate: periodEndDate },
	});

	if (!salaryStructureResult.success) {
		return failure({
			type: "ValidationError",
			message: "An active salary structure is required to compute overtime pay",
		});
	}

	const overtimeHourlyRateDivisor = Number(salaryStructureResult.data.overtimeHourlyRateDivisor);

	if (!Number.isFinite(overtimeHourlyRateDivisor) || overtimeHourlyRateDivisor <= 0) {
		return failure({
			type: "ValidationError",
			message: "The active salary structure has an invalid overtime rate divisor",
		});
	}

	const overtimeHourlyRate = roundDecimal(
		toBig(salaryStructureResult.data.basicSalary).div(overtimeHourlyRateDivisor)
	);

	return success(
		computeOvertimePay(
			weekdayOvertimeHours,
			weekendOvertimeHours,
			publicHolidayOvertimeHours,
			overtimeHourlyRate
		)
	);
}

function buildDuplicateRecordMessage(record: OvertimeRecordRow) {
	if (record.status === OVERTIME_STATUS.DRAFT) {
		return `An overtime record already exists for this employee and period with status ${record.status}. Update the draft record instead.`;
	}

	return `An overtime record already exists for this employee and period with status ${record.status}.`;
}

function hasOvertimeSnapshotChanged(
	record: OvertimeRecordRow,
	computedValues: {
		overtimeHourlyRate: number;
		weekdayOvertimePay: number;
		weekendOvertimePay: number;
		publicHolidayOvertimePay: number;
		totalOvertimePay: number;
	}
) {
	return (
		roundDecimal(record.overtimeHourlyRate) !== computedValues.overtimeHourlyRate ||
		roundDecimal(record.weekdayOvertimePay) !== computedValues.weekdayOvertimePay ||
		roundDecimal(record.weekendOvertimePay) !== computedValues.weekendOvertimePay ||
		roundDecimal(record.publicHolidayOvertimePay) !== computedValues.publicHolidayOvertimePay ||
		roundDecimal(record.totalOvertimePay) !== computedValues.totalOvertimePay
	);
}

function getPeriodRangeConditions({
	fromMonth,
	fromYear,
	toMonth,
	toYear,
}: z.infer<typeof overtimeSummaryRangeSchema>) {
	const fromIndex = getPeriodIndex(fromMonth, fromYear);
	const toIndex = getPeriodIndex(toMonth, toYear);

	return sql`${overtimeRecords.periodYear} * 100 + ${overtimeRecords.periodMonth} >= ${fromIndex} and ${overtimeRecords.periodYear} * 100 + ${overtimeRecords.periodMonth} <= ${toIndex}`;
}

function toOvertimePersistedValues(values: {
	weekdayOvertimeHours: number;
	weekendOvertimeHours: number;
	publicHolidayOvertimeHours: number;
	overtimeHourlyRate: number;
	weekdayOvertimePay: number;
	weekendOvertimePay: number;
	publicHolidayOvertimePay: number;
	totalOvertimePay: number;
}) {
	return {
		weekdayOvertimeHours: toDecimalString(values.weekdayOvertimeHours),
		weekendOvertimeHours: toDecimalString(values.weekendOvertimeHours),
		publicHolidayOvertimeHours: toDecimalString(values.publicHolidayOvertimeHours),
		overtimeHourlyRate: toDecimalString(values.overtimeHourlyRate),
		weekdayOvertimePay: toDecimalString(values.weekdayOvertimePay),
		weekendOvertimePay: toDecimalString(values.weekendOvertimePay),
		publicHolidayOvertimePay: toDecimalString(values.publicHolidayOvertimePay),
		totalOvertimePay: toDecimalString(values.totalOvertimePay),
	};
}

function isUniquePeriodViolation(error: unknown) {
	return Boolean(
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "23505" &&
		"constraint" in error &&
		error.constraint === "uq_overtime_records_employee_period"
	);
}

async function createOvertimeRecord({
	payload,
	createdBy,
}: {
	payload: OvertimeCreatePayload;
	createdBy: string;
}): Promise<Result<OvertimeMutationResponse>> {
	const result = await getEligibleEmployee(payload.employeeId);

	if (!result.success) return result;

	const periodMonth = Number(payload.periodMonth);
	const periodYear = Number(payload.periodYear);

	if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) {
		return failure({
			type: "ValidationError",
			message: "Period month must be between 1 and 12",
		});
	}

	if (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2100) {
		return failure({
			type: "ValidationError",
			message: "Period year must be between 2000 and 2100",
		});
	}

	if (isFuturePayrollPeriod(periodMonth, periodYear)) {
		const current = getCurrentPeriodParts();
		return failure({
			type: "ValidationError",
			message: `Overtime cannot be entered for a future month. Current open month is ${current.periodMonth}/${current.periodYear}.`,
		});
	}

	const existingRecord = await getExistingOvertimeRecordForPeriod(
		payload.employeeId,
		periodYear,
		periodMonth
	);

	if (existingRecord) {
		return failure({
			type: "ConflictError",
			message: buildDuplicateRecordMessage(existingRecord),
		});
	}

	const parsedHours = parseHourValues(payload);
	const computationResult = await resolveOvertimeComputation({
		employeeId: payload.employeeId,
		periodMonth,
		periodYear,
		...parsedHours,
	});

	if (!computationResult.success) {
		return computationResult;
	}

	const hourValidation = validateHourValues(parsedHours);

	if (!hourValidation.success) {
		return hourValidation;
	}

	try {
		const [record] = await db
			.insert(overtimeRecords)
			.values({
				employeeId: payload.employeeId,
				periodMonth,
				periodYear,
				notes: payload.notes,
				status: OVERTIME_STATUS.DRAFT,
				createdBy,
				...toOvertimePersistedValues({
					...parsedHours,
					...computationResult.data,
				}),
			})
			.returning();

		return success({
			record: mapOvertimeRecord(record),
			warnings: hourValidation.data.warnings,
		});
	} catch (error) {
		if (isUniquePeriodViolation(error)) {
			return failure({
				type: "ConflictError",
				message:
					"An overtime record already exists for this employee and period. Refresh and try again.",
			});
		}

		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create overtime record",
		});
	}
}

async function updateOvertimeRecord({
	recordId,
	payload,
}: {
	recordId: string;
	payload: OvertimeRecordUpdatePayload;
}): Promise<Result<OvertimeMutationResponse>> {
	const existingRecord = await getOvertimeRecordById(recordId);

	if (!existingRecord) {
		return failure({
			type: "NotFoundError",
			message: "Overtime record not found",
		});
	}

	if (existingRecord.status !== OVERTIME_STATUS.DRAFT) {
		return failure({
			type: "ValidationError",
			message: `Only draft overtime records can be updated. This record is ${existingRecord.status}.`,
		});
	}

	const parsedHours = parseHourValues(payload);
	const hourValidation = validateHourValues(parsedHours);

	if (!hourValidation.success) {
		return hourValidation;
	}

	const computationResult = await resolveOvertimeComputation({
		employeeId: existingRecord.employeeId,
		periodMonth: existingRecord.periodMonth,
		periodYear: existingRecord.periodYear,
		...parsedHours,
	});

	if (!computationResult.success) {
		return computationResult;
	}

	try {
		const [record] = await db
			.update(overtimeRecords)
			.set({
				notes: payload.notes,
				...toOvertimePersistedValues({
					...parsedHours,
					...computationResult.data,
				}),
			})
			.where(eq(overtimeRecords.id, recordId))
			.returning();

		return success({
			record: mapOvertimeRecord(record),
			warnings: hourValidation.data.warnings,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update overtime record",
		});
	}
}

async function approveOvertimeRecord({
	recordId,
	approverId,
}: {
	recordId: string;
	approverId: string;
}): Promise<Result<OvertimeMutationResponse>> {
	const existingRecord = await getOvertimeRecordById(recordId);

	if (!existingRecord) {
		return failure({
			type: "NotFoundError",
			message: "Overtime record not found",
		});
	}

	if (existingRecord.status !== OVERTIME_STATUS.DRAFT) {
		return failure({
			type: "ValidationError",
			message: `Only draft overtime records can be approved. This record is ${existingRecord.status}.`,
		});
	}

	const parsedHours = parseHourValues(existingRecord);
	const hourValidation = validateHourValues(parsedHours);

	if (!hourValidation.success) {
		return hourValidation;
	}

	const computationResult = await resolveOvertimeComputation({
		employeeId: existingRecord.employeeId,
		periodMonth: existingRecord.periodMonth,
		periodYear: existingRecord.periodYear,
		...parsedHours,
	});

	if (!computationResult.success) {
		return computationResult;
	}

	const warnings = [...hourValidation.data.warnings];

	if (hasOvertimeSnapshotChanged(existingRecord, computationResult.data)) {
		warnings.push(
			"Overtime pay was recomputed using the current active salary structure before approval."
		);
	}

	try {
		const record = await db.transaction(async (tx) => {
			const [updated] = await tx
				.update(overtimeRecords)
				.set({
					status: OVERTIME_STATUS.APPROVED,
					approvedBy: approverId,
					approvedAt: new Date(),
					...toOvertimePersistedValues({
						...parsedHours,
						...computationResult.data,
					}),
				})
				.where(eq(overtimeRecords.id, recordId))
				.returning();

			return updated;
		});

		return success({
			record: mapOvertimeRecord(record),
			warnings,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to approve overtime record",
		});
	}
}

async function revokeOvertimeApproval(recordId: string): Promise<Result<OvertimeRecordView>> {
	const existingRecord = await getOvertimeRecordById(recordId);

	if (!existingRecord) {
		return failure({
			type: "NotFoundError",
			message: "Overtime record not found",
		});
	}

	if (existingRecord.status !== OVERTIME_STATUS.APPROVED) {
		return failure({
			type: "ValidationError",
			message: `Only approved overtime records can have approval revoked. This record is ${existingRecord.status}.`,
		});
	}

	if (existingRecord.payrollSlipId) {
		return failure({
			type: "ValidationError",
			message:
				"This overtime record has already been linked to payroll and cannot be revoked without reversing the payroll run first.",
		});
	}

	try {
		const [record] = await db
			.update(overtimeRecords)
			.set({
				status: OVERTIME_STATUS.DRAFT,
				approvedBy: null,
				approvedAt: null,
			})
			.where(eq(overtimeRecords.id, recordId))
			.returning();

		return success(mapOvertimeRecord(record));
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to revoke overtime approval",
		});
	}
}

async function deleteOvertimeRecord(recordId: string): Promise<Result<undefined>> {
	const existingRecord = await getOvertimeRecordById(recordId);

	if (!existingRecord) {
		return failure({
			type: "NotFoundError",
			message: "Overtime record not found",
		});
	}

	if (existingRecord.status !== OVERTIME_STATUS.DRAFT) {
		return failure({
			type: "ValidationError",
			message: `Only draft overtime records can be deleted. This record is ${existingRecord.status}.`,
		});
	}

	try {
		await db.delete(overtimeRecords).where(eq(overtimeRecords.id, recordId));
		return success(undefined);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to delete overtime record",
		});
	}
}

async function getOvertimeRecordsByPeriod(
	periodMonth: number,
	periodYear: number,
	filters?: Pick<OvertimePeriodFilters, "departmentId" | "q" | "status">
): Promise<Array<OvertimeRecordListItem>> {
	const conditions: Array<SQL | undefined> = [
		eq(overtimeRecords.periodMonth, periodMonth),
		eq(overtimeRecords.periodYear, periodYear),
		isNull(employees.deletedAt),
	];

	if (filters?.status) {
		conditions.push(eq(overtimeRecords.status, filters.status));
	}

	if (filters?.departmentId) {
		conditions.push(eq(employees.departmentId, filters.departmentId));
	}

	const searchCondiotions = employeeSearchCondition(filters?.q);
	if (searchCondiotions) conditions.push(searchCondiotions);

	const rows = await db
		.select({
			id: overtimeRecords.id,
			employeeId: overtimeRecords.employeeId,
			payrollPeriodId: overtimeRecords.payrollPeriodId,
			periodMonth: overtimeRecords.periodMonth,
			periodYear: overtimeRecords.periodYear,
			weekdayOvertimeHours: overtimeRecords.weekdayOvertimeHours,
			weekendOvertimeHours: overtimeRecords.weekendOvertimeHours,
			publicHolidayOvertimeHours: overtimeRecords.publicHolidayOvertimeHours,
			overtimeHourlyRate: overtimeRecords.overtimeHourlyRate,
			weekdayOvertimePay: overtimeRecords.weekdayOvertimePay,
			weekendOvertimePay: overtimeRecords.weekendOvertimePay,
			publicHolidayOvertimePay: overtimeRecords.publicHolidayOvertimePay,
			totalOvertimePay: overtimeRecords.totalOvertimePay,
			status: overtimeRecords.status,
			approvedBy: overtimeRecords.approvedBy,
			approvedAt: overtimeRecords.approvedAt,
			payrollSlipId: overtimeRecords.payrollSlipId,
			notes: overtimeRecords.notes,
			createdBy: overtimeRecords.createdBy,
			createdAt: overtimeRecords.createdAt,
			updatedAt: overtimeRecords.updatedAt,
			employeeNo: employees.employeeNo,
			firstName: employees.firstName,
			lastName: employees.lastName,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			departmentId: employees.departmentId,
			departmentName: departments.name,
		})
		.from(overtimeRecords)
		.innerJoin(employees, eq(overtimeRecords.employeeId, employees.id))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(and(...conditions))
		.orderBy(asc(employees.lastName), asc(employees.firstName));

	return rows.map(mapOvertimeListRow);
}

async function getOvertimeRecordForEmployee(
	employeeId: string,
	periodMonth: number,
	periodYear: number
): Promise<OvertimeRecordView | null> {
	const record = await getExistingOvertimeRecordForPeriod(employeeId, periodYear, periodMonth);
	return record ? mapOvertimeRecord(record) : null;
}

async function getApprovedOvertimeForPayrollPeriod(periodMonth: number, periodYear: number) {
	const rows = await db
		.select({
			recordId: overtimeRecords.id,
			employeeId: overtimeRecords.employeeId,
			totalOvertimePay: overtimeRecords.totalOvertimePay,
			overtimeHourlyRate: overtimeRecords.overtimeHourlyRate,
			weekdayOvertimeHours: overtimeRecords.weekdayOvertimeHours,
			weekendOvertimeHours: overtimeRecords.weekendOvertimeHours,
			publicHolidayOvertimeHours: overtimeRecords.publicHolidayOvertimeHours,
		})
		.from(overtimeRecords)
		.where(
			and(
				eq(overtimeRecords.periodMonth, periodMonth),
				eq(overtimeRecords.periodYear, periodYear),
				eq(overtimeRecords.status, OVERTIME_STATUS.APPROVED)
			)
		)
		.orderBy(asc(overtimeRecords.employeeId));

	return rows.map((row) => ({
		recordId: row.recordId,
		employeeId: row.employeeId,
		totalOvertimePay: roundDecimal(row.totalOvertimePay),
		overtimeHourlyRate: roundDecimal(row.overtimeHourlyRate),
		weekdayOvertimeHours: roundDecimal(row.weekdayOvertimeHours),
		weekendOvertimeHours: roundDecimal(row.weekendOvertimeHours),
		publicHolidayOvertimeHours: roundDecimal(row.publicHolidayOvertimeHours),
	}));
}

async function getOvertimeSummaryForEmployee(
	params: z.infer<typeof overtimeSummaryRangeSchema>
): Promise<Result<OvertimeSummaryResponse>> {
	const result = await getEligibleEmployee(params.employeeId);

	if (!result.success) return result;

	const rows = await db.query.overtimeRecords.findMany({
		where: and(eq(overtimeRecords.employeeId, params.employeeId), getPeriodRangeConditions(params)),
		orderBy: [desc(overtimeRecords.periodYear), desc(overtimeRecords.periodMonth)],
	});

	const records = rows.map(mapOvertimeRecord);
	const totals = records.reduce(
		(accumulator, record) => {
			accumulator.weekdayOvertimeHours = roundDecimal(
				toBig(accumulator.weekdayOvertimeHours).plus(record.weekdayOvertimeHours)
			);
			accumulator.weekendOvertimeHours = roundDecimal(
				toBig(accumulator.weekendOvertimeHours).plus(record.weekendOvertimeHours)
			);
			accumulator.publicHolidayOvertimeHours = roundDecimal(
				toBig(accumulator.publicHolidayOvertimeHours).plus(record.publicHolidayOvertimeHours)
			);
			accumulator.totalOvertimePay = roundDecimal(
				toBig(accumulator.totalOvertimePay).plus(record.totalOvertimePay)
			);
			accumulator.totalOvertimeHours = roundDecimal(
				toBig(accumulator.totalOvertimeHours)
					.plus(record.weekdayOvertimeHours)
					.plus(record.weekendOvertimeHours)
					.plus(record.publicHolidayOvertimeHours)
			);
			return accumulator;
		},
		{
			weekdayOvertimeHours: 0,
			weekendOvertimeHours: 0,
			publicHolidayOvertimeHours: 0,
			totalOvertimeHours: 0,
			totalOvertimePay: 0,
		}
	);

	return success({
		employeeId: params.employeeId,
		totals,
		records,
	});
}

async function getOvertimeRecordDetail(recordId: string): Promise<Result<OvertimeDetailView>> {
	const row = await db
		.select({
			id: overtimeRecords.id,
			employeeId: overtimeRecords.employeeId,
			payrollPeriodId: overtimeRecords.payrollPeriodId,
			periodMonth: overtimeRecords.periodMonth,
			periodYear: overtimeRecords.periodYear,
			weekdayOvertimeHours: overtimeRecords.weekdayOvertimeHours,
			weekendOvertimeHours: overtimeRecords.weekendOvertimeHours,
			publicHolidayOvertimeHours: overtimeRecords.publicHolidayOvertimeHours,
			overtimeHourlyRate: overtimeRecords.overtimeHourlyRate,
			weekdayOvertimePay: overtimeRecords.weekdayOvertimePay,
			weekendOvertimePay: overtimeRecords.weekendOvertimePay,
			publicHolidayOvertimePay: overtimeRecords.publicHolidayOvertimePay,
			totalOvertimePay: overtimeRecords.totalOvertimePay,
			status: overtimeRecords.status,
			approvedBy: overtimeRecords.approvedBy,
			approvedAt: overtimeRecords.approvedAt,
			payrollSlipId: overtimeRecords.payrollSlipId,
			notes: overtimeRecords.notes,
			createdBy: overtimeRecords.createdBy,
			createdAt: overtimeRecords.createdAt,
			updatedAt: overtimeRecords.updatedAt,
			employeeNo: employees.employeeNo,
			firstName: employees.firstName,
			lastName: employees.lastName,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			departmentId: employees.departmentId,
			departmentName: departments.name,
			approvedByName: sql<string | null>`null`,
			createdByName: users.name,
		})
		.from(overtimeRecords)
		.innerJoin(employees, eq(overtimeRecords.employeeId, employees.id))
		.leftJoin(users, eq(users.id, overtimeRecords.createdBy))
		.leftJoin(departments, eq(employees.departmentId, departments.id))
		.where(eq(overtimeRecords.id, recordId))
		.then((rows) => rows[0] ?? null);

	if (!row) {
		return failure({
			type: "NotFoundError",
			message: "Overtime record not found",
		});
	}

	return success({
		...mapOvertimeListRow(row),
		approvedByName: toTitleCase(row.approvedByName?.toLowerCase() ?? row.approvedBy ?? "-"),
		createdByName: toTitleCase(row.createdByName?.toLowerCase() ?? row.createdBy ?? "-"),
	});
}

async function getOvertimeFormOptions(): Promise<OvertimeFormOptions> {
	const [employeeRows, departmentRows] = await Promise.all([
		db
			.select({
				id: employees.id,
				employeeNo: employees.employeeNo,
				fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
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
	]);

	return {
		employees: employeeRows,
		departments: departmentRows,
	};
}

export const linkOvertimeRecordToPayrollSlipFn = createServerFn({ method: "POST" })
	.validator(overtimePayrollLinkSchema)
	.handler(async ({ data: { recordId, payrollSlipId } }) => {
		await requireOvertimeApproveAccess();
		await requirePermission("payroll-process:create");

		const existingRecord = await getOvertimeRecordById(recordId);

		if (!existingRecord) {
			return failure({
				type: "NotFoundError",
				message: "Overtime record not found",
			});
		}

		if (existingRecord.payrollSlipId && existingRecord.payrollSlipId !== payrollSlipId) {
			return failure({
				type: "ConflictError",
				message:
					"Overtime record is already linked to a different payroll slip. Investigate the payroll linkage before retrying.",
			});
		}

		if (existingRecord.payrollSlipId === payrollSlipId) {
			return failure({
				type: "ConflictError",
				message: "Overtime record is already linked to this payroll slip",
			});
		}

		if (existingRecord.status !== OVERTIME_STATUS.APPROVED) {
			return failure({
				type: "ValidationError",
				message: "Only approved overtime records can be linked to a payroll slip",
			});
		}

		try {
			const record = await db.transaction(async (tx) => {
				const [updated] = await tx
					.update(overtimeRecords)
					.set({
						payrollSlipId,
						status: OVERTIME_STATUS.PAID,
					})
					.where(
						and(
							eq(overtimeRecords.id, recordId),
							eq(overtimeRecords.status, OVERTIME_STATUS.APPROVED),
							isNull(overtimeRecords.payrollSlipId)
						)
					)
					.returning();

				if (!updated) {
					throw new Error("Overtime record is no longer linkable");
				}

				return updated;
			});

			return success(mapOvertimeRecord(record));
		} catch (error) {
			console.error(error);
			return failure({
				type: "ApplicationError",
				message: "Failed to link overtime record to payroll slip",
			});
		}
	});

// async function linkOvertimeRecordToPayrollSlip({
// 	recordId,
// 	payrollSlipId,
// }: z.infer<typeof overtimePayrollLinkSchema>): Promise<Result<OvertimeRecordView>> {

// }

async function requireOvertimeViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("overtime-records:view");
}

async function requireOvertimeCreateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("overtime-records:create");
}

async function requireOvertimeUpdateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("overtime-records:update");
}

async function requireOvertimeApproveAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("overtime-records:approve");
}

async function requireOvertimeDeleteAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("overtime-records:delete");
}

export const getOvertimeFormOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireOvertimeViewAccess();
		return getOvertimeFormOptions();
	});

export const getOvertimeRecordsByPeriodFn = createServerFn()
	.middleware([authMiddleware])
	.validator(overtimeRecordPeriodSearchSchema)
	.handler(async ({ data }) => {
		await requireOvertimeViewAccess();
		return getOvertimeRecordsByPeriod(data.periodMonth, data.periodYear, data);
	});

export const getOvertimeRecordForEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(overtimeRecordByEmployeePeriodSchema)
	.handler(async ({ data }) => {
		await requireOvertimeViewAccess();
		return getOvertimeRecordForEmployee(data.employeeId, data.periodMonth, data.periodYear);
	});

export const getOvertimeRecordDetailFn = createServerFn()
	.middleware([authMiddleware])
	.validator(overtimeRecordByIdSchema)
	.handler(async ({ data }) => {
		await requireOvertimeViewAccess();
		const result = await getOvertimeRecordDetail(data.recordId);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		return result.data;
	});

export const getOvertimeSummaryForEmployeeFn = createServerFn()
	.middleware([authMiddleware])
	.validator(overtimeSummaryRangeSchema)
	.handler(async ({ data }) => {
		await requireOvertimeViewAccess();
		const result = await getOvertimeSummaryForEmployee(data);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		return result.data;
	});

export const getApprovedOvertimeForPayrollPeriodFn = createServerFn()
	.middleware([authMiddleware])
	.validator(overtimeRecordPeriodSchema)
	.handler(async ({ data }) => {
		await requireOvertimeViewAccess();
		return getApprovedOvertimeForPayrollPeriod(data.periodMonth, data.periodYear);
	});

export const createOvertimeRecordFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(overtimeRecordCreateRequestSchema)
	.handler(async ({ data, context }) => {
		await requireOvertimeCreateAccess();
		const result = await createOvertimeRecord({
			payload: data,
			createdBy: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "create overtime record",
					description: `Created overtime record for employee ${data.employeeId} (${data.periodMonth}/${data.periodYear})`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const updateOvertimeRecordFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(overtimeRecordUpdateRequestSchema)
	.handler(async ({ data, context }) => {
		await requireOvertimeUpdateAccess();
		const result = await updateOvertimeRecord(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "update overtime record",
					description: `Updated overtime record ${data.recordId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const approveOvertimeRecordFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(overtimeRecordStatusActionSchema)
	.handler(async ({ data, context }) => {
		await requireOvertimeApproveAccess();
		const result = await approveOvertimeRecord({
			recordId: data.recordId,
			approverId: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "approve overtime record",
					description: `Approved overtime record ${data.recordId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const revokeOvertimeApprovalFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(overtimeRecordStatusActionSchema)
	.handler(async ({ data, context }) => {
		await requireOvertimeApproveAccess();
		const result = await revokeOvertimeApproval(data.recordId);

		if (result.success) {
			await logActivity({
				data: {
					action: "revoke overtime approval",
					description: `Revoked approval for overtime record ${data.recordId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const deleteOvertimeRecordFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(overtimeRecordDeleteSchema)
	.handler(async ({ data, context }) => {
		await requireOvertimeDeleteAccess();
		const result = await deleteOvertimeRecord(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "delete overtime record",
					description: `Deleted overtime record ${data}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export type OvertimeFormOptionsResponse = Awaited<ReturnType<typeof getOvertimeFormOptionsFn>>;
export type OvertimePeriodRecord = Awaited<ReturnType<typeof getOvertimeRecordsByPeriodFn>>[number];
export type OvertimeRecordDetailResponse = Awaited<ReturnType<typeof getOvertimeRecordDetailFn>>;
export type OvertimeSummaryView = Awaited<ReturnType<typeof getOvertimeSummaryForEmployeeFn>>;
export type OvertimeCreatePayloadInput = OvertimeRecordCreateFormInput;
