import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNull,
	lte,
	ne,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { employees, salaryStructures } from "@/drizzle/schema";
import {
	canAutoCloseCurrentStructure,
	computeGrossPayComponents,
	doSalaryRangesOverlap,
	formatSalaryStructureDateRange,
	formatSalaryStructureFormValues,
	getSalaryHistoryStatus,
	normalizePayrollText,
	subtractOneDay,
	toPayrollDecimalString,
	type SalaryStructureWithComputedComponents,
} from "@/features/payroll/lib/helpers";
import { PAYROLL_STATUTORY_LIMITS } from "@/features/payroll/lib/payroll-constants";
import {
	employeeIdSchema,
	getForbiddenSalaryStructureUpdateFields,
	pickSalaryStructureMetadataPayload,
	salaryHistoryParamsSchema,
	salaryStructureCreatePrefillSearchSchema,
	salaryStructureCreateRequestSchema,
	salaryStructureDeactivateSchema,
	salaryStructureDetailParamsSchema,
	salaryStructureDirectoryFilterSchema,
	salaryStructureEmployeeSummarySchema,
	type salaryStructureMetadataUpdateSchema,
	salaryStructurePeriodLookupSchema,
	salaryStructureUpdateRequestSchema,
} from "@/features/payroll/services/schemas";
import { normalizeText } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type SalaryStructureRecord = typeof salaryStructures.$inferSelect;
type SalaryStructureCreatePayload = z.infer<typeof salaryStructureCreateRequestSchema>;
type SalaryStructureMetadataUpdatePayload = z.infer<typeof salaryStructureMetadataUpdateSchema>;

type SalaryStructureCreateResponse = {
	record: SalaryStructureRecord;
	warnings: string[];
	summary: {
		closedPriorStructure: null | {
			id: string;
			newEffectiveTo: string;
		};
	};
};

type SalaryHistoryItem = SalaryStructureRecord & {
	grossPay: number;
	status: "active" | "superseded" | "future";
};

type SalaryStructureDetail = SalaryStructureRecord & {
	computedComponents: ReturnType<typeof computeGrossPayComponents>;
};

type SalaryStructureEmployeeSummary = {
	id: string;
	employeeNo: string;
	fullName: string;
	status: typeof employees.$inferSelect.status;
	jobTitle: string | null;
};

type SalaryStructureDirectoryItem = SalaryStructureEmployeeSummary & {
	currentStructureId: string | null;
	currentGrossPay: number | null;
	currentEffectiveFrom: string | null;
	currentPayFrequency: SalaryStructureRecord["payFrequency"] | null;
	structureStatus: "configured" | "missing";
};

type ActiveStructureBulkResponse = {
	structuresByEmployeeId: Record<string, SalaryStructureWithComputedComponents>;
	errors: Array<{
		employeeId: string;
		employeeNo: string;
		fullName: string;
		reason: string;
	}>;
};

function getSalaryStructureInsertValues(payload: SalaryStructureCreatePayload, createdBy: string) {
	return {
		employeeId: payload.employeeId,
		effectiveFrom: payload.effectiveFrom,
		effectiveTo: payload.effectiveTo ?? null,
		payFrequency: payload.payFrequency,
		basicSalary: toPayrollDecimalString(payload.basicSalary),
		houseAllowance: toPayrollDecimalString(payload.houseAllowance),
		transportAllowance: toPayrollDecimalString(payload.transportAllowance),
		commuterAllowance: toPayrollDecimalString(payload.commuterAllowance),
		mealAllowance: toPayrollDecimalString(payload.mealAllowance),
		airtimeAllowance: toPayrollDecimalString(payload.airtimeAllowance),
		otherAllowances: toPayrollDecimalString(payload.otherAllowances),
		otherAllowancesDescription: normalizePayrollText(payload.otherAllowancesDescription),
		pensionEmployeeContribution: toPayrollDecimalString(payload.pensionEmployeeContribution),
		pensionEmployerContribution: toPayrollDecimalString(payload.pensionEmployerContribution),
		pensionFundName: normalizePayrollText(payload.pensionFundName),
		mortgageInterestMonthly: toPayrollDecimalString(payload.mortgageInterestMonthly),
		postRetirementMedicalMonthly: toPayrollDecimalString(payload.postRetirementMedicalMonthly),
		insurancePremiumsMonthly: toPayrollDecimalString(payload.insurancePremiumsMonthly),
		hasHelbLoan: payload.hasHelbLoan,
		helbMonthlyDeduction: toPayrollDecimalString(
			payload.hasHelbLoan ? payload.helbMonthlyDeduction : 0
		),
		normalHoursPerDay: toPayrollDecimalString(payload.normalHoursPerDay),
		normalDaysPerWeek: toPayrollDecimalString(payload.normalDaysPerWeek),
		overtimeHourlyRateDivisor: payload.overtimeHourlyRateDivisor,
		isActive: true,
		notes: normalizeText(payload.notes),
		createdBy,
	};
}

async function getEligibleEmployee(employeeId: string) {
	return db.query.employees.findFirst({
		columns: {
			id: true,
			employeeNo: true,
			firstName: true,
			lastName: true,
			status: true,
			jobTitle: true,
			deletedAt: true,
		},
		where: and(eq(employees.id, employeeId), isNull(employees.deletedAt)),
	});
}

async function getOverlappingStructures({
	employeeId,
	effectiveFrom,
	effectiveTo,
	excludeStructureId,
}: {
	employeeId: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	excludeStructureId?: string;
}) {
	const rows = await db.query.salaryStructures.findMany({
		where: and(
			eq(salaryStructures.employeeId, employeeId),
			excludeStructureId ? ne(salaryStructures.id, excludeStructureId) : undefined
		),
		orderBy: [asc(salaryStructures.effectiveFrom)],
	});

	return rows.filter((row) =>
		doSalaryRangesOverlap({
			existingEffectiveFrom: row.effectiveFrom,
			existingEffectiveTo: row.effectiveTo,
			newEffectiveFrom: effectiveFrom,
			newEffectiveTo: effectiveTo,
		})
	);
}

async function getSalaryStructureEmployeeSummary(
	employeeId: string
): Promise<Result<SalaryStructureEmployeeSummary>> {
	const employee = await db
		.select({
			id: employees.id,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			status: employees.status,
			jobTitle: employees.jobTitle,
		})
		.from(employees)
		.where(and(eq(employees.id, employeeId), isNull(employees.deletedAt)))
		.then((rows) => rows[0] ?? null);

	if (!employee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	return success(employee);
}

async function getActiveStructureForPeriod(
	employeeId: string,
	periodDate: string
): Promise<Result<SalaryStructureRecord>> {
	const rows = await db.query.salaryStructures.findMany({
		where: and(
			eq(salaryStructures.employeeId, employeeId),
			lte(salaryStructures.effectiveFrom, periodDate),
			or(isNull(salaryStructures.effectiveTo), gte(salaryStructures.effectiveTo, periodDate))
		),
		orderBy: [desc(salaryStructures.effectiveFrom), desc(salaryStructures.id)],
	});

	const match = rows[0] ?? null;

	if (!match) {
		return failure({
			type: "NotFoundError",
			message: `No salary structure is active for employee ${employeeId} on ${periodDate}`,
		});
	}

	return success(match);
}

async function getCurrentActiveStructure(
	employeeId: string
): Promise<Result<SalaryStructureRecord>> {
	return getActiveStructureForPeriod(employeeId, new Date().toISOString().slice(0, 10));
}

async function createSalaryStructure({
	payload,
	createdBy,
}: {
	payload: SalaryStructureCreatePayload;
	createdBy: string;
}): Promise<Result<SalaryStructureCreateResponse>> {
	const employee = await getEligibleEmployee(payload.employeeId);

	if (!employee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	if (employee.status !== "active") {
		return failure({
			type: "ValidationError",
			message: "Salary structures can only be created for active employees",
		});
	}

	const warnings: string[] = [];
	const normalizedEffectiveTo = payload.effectiveTo ?? null;
	const overlaps = await getOverlappingStructures({
		employeeId: payload.employeeId,
		effectiveFrom: payload.effectiveFrom,
		effectiveTo: normalizedEffectiveTo,
	});

	const allowedAutoCloseOverlap =
		overlaps.length === 1 &&
		canAutoCloseCurrentStructure({
			existingEffectiveFrom: overlaps[0].effectiveFrom,
			existingEffectiveTo: overlaps[0].effectiveTo,
			newEffectiveFrom: payload.effectiveFrom,
		});

	if (overlaps.length > 0 && !allowedAutoCloseOverlap) {
		const conflictingRange = formatSalaryStructureDateRange(overlaps[0]);
		return failure({
			type: "ConflictError",
			message: `Salary structure overlaps with existing record (${conflictingRange})`,
		});
	}

	if (payload.basicSalary <= 0) {
		return failure({
			type: "ValidationError",
			message: "Basic salary must be greater than zero",
		});
	}

	if (normalizedEffectiveTo && normalizedEffectiveTo <= payload.effectiveFrom) {
		return failure({
			type: "ValidationError",
			message: "Effective to date must be after effective from date",
		});
	}

	if (
		payload.pensionEmployeeContribution &&
		payload.pensionEmployeeContribution > PAYROLL_STATUTORY_LIMITS.pensionAllowableMonthly
	) {
		warnings.push(
			`Only KES ${PAYROLL_STATUTORY_LIMITS.pensionAllowableMonthly.toLocaleString()} of the employee pension contribution will be PAYE-allowable.`
		);
	}

	if (payload.hasHelbLoan && (payload.helbMonthlyDeduction ?? 0) <= 0) {
		return failure({
			type: "ValidationError",
			message: "HELB monthly deduction must be greater than zero when a HELB loan exists",
		});
	}

	try {
		const result = await db.transaction(async (tx) => {
			let closedPriorStructure: SalaryStructureCreateResponse["summary"]["closedPriorStructure"] =
				null;

			const openEndedStructure = await tx.query.salaryStructures.findFirst({
				where: and(
					eq(salaryStructures.employeeId, payload.employeeId),
					isNull(salaryStructures.effectiveTo)
				),
				orderBy: [desc(salaryStructures.effectiveFrom)],
			});

			if (openEndedStructure && openEndedStructure.effectiveFrom < payload.effectiveFrom) {
				const newEffectiveTo = subtractOneDay(payload.effectiveFrom);
				await tx
					.update(salaryStructures)
					.set({
						effectiveTo: newEffectiveTo,
						isActive: false,
					})
					.where(eq(salaryStructures.id, openEndedStructure.id));

				closedPriorStructure = {
					id: openEndedStructure.id,
					newEffectiveTo,
				};
			}

			const [record] = await tx
				.insert(salaryStructures)
				.values(getSalaryStructureInsertValues(payload, createdBy))
				.returning();

			return {
				record,
				warnings,
				summary: {
					closedPriorStructure,
				},
			};
		});

		return success(result);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create salary structure",
		});
	}
}

/**
 * Updates only metadata fields on an existing salary structure record.
 * Financial values and effective dates must be captured as a new effective-dated
 * salary structure via createSalaryStructure to preserve payroll audit integrity.
 */
async function updateSalaryStructure({
	structureId,
	payload,
}: {
	structureId: string;
	payload: SalaryStructureMetadataUpdatePayload;
}): Promise<Result<SalaryStructureRecord>> {
	const forbiddenFields = getForbiddenSalaryStructureUpdateFields(
		payload as Record<string, unknown>
	);

	if (forbiddenFields.length > 0) {
		return failure({
			type: "ValidationError",
			message:
				"Financial fields and effective dates cannot be edited on an existing salary structure. Create a new effective-dated structure instead.",
		});
	}

	const existing = await db.query.salaryStructures.findFirst({
		where: eq(salaryStructures.id, structureId),
	});

	if (!existing) {
		return failure({
			type: "NotFoundError",
			message: "Salary structure not found",
		});
	}

	const metadataPayload = pickSalaryStructureMetadataPayload(payload);
	const hasHelbLoan =
		typeof metadataPayload.hasHelbLoan === "boolean"
			? metadataPayload.hasHelbLoan
			: existing.hasHelbLoan;
	const helbMonthlyDeduction =
		typeof metadataPayload.helbMonthlyDeduction === "number"
			? metadataPayload.helbMonthlyDeduction
			: Number(existing.helbMonthlyDeduction ?? 0);

	if (hasHelbLoan && helbMonthlyDeduction <= 0) {
		return failure({
			type: "ValidationError",
			message: "HELB monthly deduction must be greater than zero when a HELB loan exists",
		});
	}

	try {
		const [updated] = await db
			.update(salaryStructures)
			.set({
				notes:
					"notes" in metadataPayload
						? normalizeText((metadataPayload.notes as string | null | undefined) ?? null)
						: existing.notes,
				pensionFundName:
					"pensionFundName" in metadataPayload
						? normalizePayrollText(
								(metadataPayload.pensionFundName as string | null | undefined) ?? null
							)
						: existing.pensionFundName,
				otherAllowancesDescription:
					"otherAllowancesDescription" in metadataPayload
						? normalizePayrollText(
								(metadataPayload.otherAllowancesDescription as string | null | undefined) ?? null
							)
						: existing.otherAllowancesDescription,
				hasHelbLoan,
				helbMonthlyDeduction: toPayrollDecimalString(hasHelbLoan ? helbMonthlyDeduction : 0),
			})
			.where(eq(salaryStructures.id, structureId))
			.returning();

		return success(updated);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update salary structure metadata",
		});
	}
}

async function deactivateSalaryStructure({
	structureId,
	effectiveTo,
}: {
	structureId: string;
	effectiveTo: string;
}): Promise<Result<SalaryStructureRecord>> {
	const existing = await db.query.salaryStructures.findFirst({
		where: eq(salaryStructures.id, structureId),
	});

	if (!existing) {
		return failure({
			type: "NotFoundError",
			message: "Salary structure not found",
		});
	}

	if (effectiveTo < existing.effectiveFrom) {
		return failure({
			type: "ValidationError",
			message: "Effective to date cannot be before the record effective from date",
		});
	}

	try {
		const [updated] = await db
			.update(salaryStructures)
			.set({
				effectiveTo,
				isActive: false,
			})
			.where(eq(salaryStructures.id, structureId))
			.returning();

		return success(updated);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to deactivate salary structure",
		});
	}
}

async function getSalaryHistory(employeeId: string): Promise<Result<Array<SalaryHistoryItem>>> {
	const employee = await getSalaryStructureEmployeeSummary(employeeId);

	if (!employee.success) {
		return employee;
	}

	const rows = await db.query.salaryStructures.findMany({
		where: eq(salaryStructures.employeeId, employeeId),
		orderBy: [desc(salaryStructures.effectiveFrom), desc(salaryStructures.id)],
	});

	const data = rows.map((row) => ({
		...row,
		grossPay: computeGrossPayComponents(row).grossPay,
		status: getSalaryHistoryStatus({
			effectiveFrom: row.effectiveFrom,
			effectiveTo: row.effectiveTo,
		}),
	}));

	return success(data);
}

async function getSalaryStructureById(structureId: string): Promise<Result<SalaryStructureDetail>> {
	const row = await db.query.salaryStructures.findFirst({
		where: eq(salaryStructures.id, structureId),
	});

	if (!row) {
		return failure({
			type: "NotFoundError",
			message: "Salary structure not found",
		});
	}

	return success({
		...row,
		computedComponents: computeGrossPayComponents(row),
	});
}

async function getAllActiveStructuresForPeriod(
	periodDate: string
): Promise<ActiveStructureBulkResponse> {
	const activeEmployees = await db
		.select({
			id: employees.id,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
		})
		.from(employees)
		.where(and(eq(employees.status, "active"), isNull(employees.deletedAt)))
		.orderBy(asc(employees.firstName), asc(employees.lastName));

	if (!activeEmployees.length) {
		return {
			structuresByEmployeeId: {},
			errors: [],
		};
	}

	const structures = await db.query.salaryStructures.findMany({
		where: and(
			inArray(
				salaryStructures.employeeId,
				activeEmployees.map((employee) => employee.id)
			),
			lte(salaryStructures.effectiveFrom, periodDate),
			or(isNull(salaryStructures.effectiveTo), gte(salaryStructures.effectiveTo, periodDate))
		),
		orderBy: [
			asc(salaryStructures.employeeId),
			desc(salaryStructures.effectiveFrom),
			desc(salaryStructures.id),
		],
	});

	const structuresByEmployeeId: Record<string, SalaryStructureWithComputedComponents> = {};

	for (const structure of structures) {
		if (!structuresByEmployeeId[structure.employeeId]) {
			structuresByEmployeeId[structure.employeeId] = {
				...structure,
				computedComponents: computeGrossPayComponents(structure),
			};
		}
	}

	const errors = activeEmployees
		.filter((employee) => !structuresByEmployeeId[employee.id])
		.map((employee) => ({
			employeeId: employee.id,
			employeeNo: employee.employeeNo,
			fullName: employee.fullName,
			reason: `No salary structure is active for ${periodDate}`,
		}));

	return {
		structuresByEmployeeId,
		errors,
	};
}

async function getSalaryStructureDirectory(
	filters: z.infer<typeof salaryStructureDirectoryFilterSchema>
) {
	const conditions: Array<SQL | undefined> = [isNull(employees.deletedAt)];
	const query = filters.q?.trim();

	if (query) {
		const searchQuery = `%${query}%`;
		conditions.push(
			or(
				ilike(employees.employeeNo, searchQuery),
				ilike(employees.firstName, searchQuery),
				ilike(employees.lastName, searchQuery),
				ilike(sql`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`, searchQuery),
				ilike(employees.jobTitle, searchQuery)
			)
		);
	}

	const employeeRows = await db
		.select({
			id: employees.id,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			status: employees.status,
			jobTitle: employees.jobTitle,
		})
		.from(employees)
		.where(and(...conditions))
		.orderBy(asc(employees.firstName), asc(employees.lastName));

	const activeStructures = await Promise.all(
		employeeRows.map(async (employee) => {
			const current = await getCurrentActiveStructure(employee.id);
			return {
				employeeId: employee.id,
				current,
			};
		})
	);

	const currentMap = new Map(activeStructures.map((row) => [row.employeeId, row.current]));

	return employeeRows.map((employee) => {
		const current = currentMap.get(employee.id);

		if (!current?.success) {
			return {
				...employee,
				currentStructureId: null,
				currentGrossPay: null,
				currentEffectiveFrom: null,
				currentPayFrequency: null,
				structureStatus: "missing",
			} satisfies SalaryStructureDirectoryItem;
		}

		return {
			...employee,
			currentStructureId: current.data.id,
			currentGrossPay: computeGrossPayComponents(current.data).grossPay,
			currentEffectiveFrom: current.data.effectiveFrom,
			currentPayFrequency: current.data.payFrequency,
			structureStatus: "configured",
		} satisfies SalaryStructureDirectoryItem;
	});
}

async function getEmployeesForSalaryStructureOptions() {
	return db
		.select({
			id: employees.id,
			employeeNo: employees.employeeNo,
			fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
			status: employees.status,
		})
		.from(employees)
		.where(and(isNull(employees.deletedAt), eq(employees.status, "active")))
		.orderBy(asc(employees.firstName), asc(employees.lastName));
}

async function requireSalaryStructureViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-structures:view");
}

async function requireSalaryStructureCreateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-structures:create");
}

async function requireSalaryStructureUpdateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-structures:update");
}

async function requireSalaryStructureDeactivateAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("salary-structures:deactivate");
}

export const getSalaryStructureDirectoryFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryStructureDirectoryFilterSchema)
	.handler(async ({ data }) => {
		await requireSalaryStructureViewAccess();
		return getSalaryStructureDirectory(data);
	});

export const getEmployeesForSalaryStructureOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireSalaryStructureCreateAccess();
		return getEmployeesForSalaryStructureOptions();
	});

export const getSalaryStructureEmployeeSummaryFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryStructureEmployeeSummarySchema)
	.handler(async ({ data: { employeeId } }) => {
		await requireSalaryStructureViewAccess();
		const result = await getSalaryStructureEmployeeSummary(employeeId);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		return result.data;
	});

export const getSalaryHistoryFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryHistoryParamsSchema)
	.handler(async ({ data: { employeeId } }) => {
		await requireSalaryStructureViewAccess();
		const result = await getSalaryHistory(employeeId);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		return result.data;
	});

export const getSalaryStructureByIdFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryStructureDetailParamsSchema)
	.handler(async ({ data: { structureId } }) => {
		await requireSalaryStructureViewAccess();
		const result = await getSalaryStructureById(structureId);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		return result.data;
	});

export const getActiveStructureForPeriodFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryStructurePeriodLookupSchema)
	.handler(async ({ data: { employeeId, periodDate } }) => {
		await requireSalaryStructureViewAccess();
		return getActiveStructureForPeriod(employeeId, periodDate);
	});

export const getCurrentActiveStructureFn = createServerFn()
	.middleware([authMiddleware])
	.validator(employeeIdSchema)
	.handler(async ({ data: employeeId }) => {
		await requireSalaryStructureViewAccess();
		return getCurrentActiveStructure(employeeId);
	});

export const getAllActiveStructuresForPeriodFn = createServerFn()
	.middleware([authMiddleware])
	.validator(z.object({ periodDate: z.string().trim().min(1, "Period date is required") }))
	.handler(async ({ data: { periodDate } }) => {
		await requireSalaryStructureViewAccess();
		return getAllActiveStructuresForPeriod(periodDate);
	});

export const createSalaryStructureFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(salaryStructureCreateRequestSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryStructureCreateAccess();
		const formattedSalaryData = formatSalaryStructureFormValues(data);
		const result = await createSalaryStructure({
			payload: {
				...formattedSalaryData,
				helbMonthlyDeduction: formattedSalaryData.hasHelbLoan
					? formattedSalaryData.helbMonthlyDeduction
					: 0,
			},
			createdBy: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "create salary structure",
					description: `Created salary structure for employee ${data.employeeId} effective ${data.effectiveFrom}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const updateSalaryStructureFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(salaryStructureUpdateRequestSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryStructureUpdateAccess();
		const result = await updateSalaryStructure({
			structureId: data.structureId,
			payload: data.payload,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "update salary structure metadata",
					description: `Updated salary structure ${data.structureId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const deactivateSalaryStructureFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(salaryStructureDeactivateSchema)
	.handler(async ({ data, context }) => {
		await requireSalaryStructureDeactivateAccess();
		const result = await deactivateSalaryStructure(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "deactivate salary structure",
					description: `Deactivated salary structure ${data.structureId} effective ${data.effectiveTo}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const getSalaryStructureCreatePrefillFn = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryStructureCreatePrefillSearchSchema)
	.handler(async ({ data }) => {
		await requireSalaryStructureCreateAccess();
		return data;
	});

export type SalaryStructureDirectoryResponse = Awaited<
	ReturnType<typeof getSalaryStructureDirectoryFn>
>;
export type SalaryStructureDirectoryListItem = SalaryStructureDirectoryResponse[number];
export type SalaryStructureEmployeeOption = Awaited<
	ReturnType<typeof getEmployeesForSalaryStructureOptionsFn>
>[number];
export type SalaryHistoryListItem = Awaited<ReturnType<typeof getSalaryHistoryFn>>[number];
export type SalaryStructureDetailView = Awaited<ReturnType<typeof getSalaryStructureByIdFn>>;
