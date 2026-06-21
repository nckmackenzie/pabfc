import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { statutoryRates } from "@/drizzle/schema";
import {
	computeFullPayrollDeductions,
	type PayrollPreviewSalaryStructureComponents,
} from "@/features/payroll/lib/paye-engine";
import { resolveStatutoryRates } from "@/features/payroll/lib/payroll-rate-resolver";
import {
	doSalaryRangesOverlap,
	getSalaryHistoryStatus,
	toPayrollDecimalString,
} from "@/features/payroll/lib/helpers";
import {
	STATUTORY_RATE_MULTI_ROW_CATEGORIES,
	STATUTORY_RATE_CATEGORY_KEYS,
	STATUTORY_RATE_CATEGORY_METADATA,
	type StatutoryRateCategory as StatutoryRateCategoryKey,
} from "@/features/payroll/lib/payroll-constants";
import {
	type PayrollPreviewCalculationPayload,
	type StatutoryRateCreatePayload,
	previewPayrollCalculationSchema,
	statutoryRateCreateSchema,
	statutoryRateHistorySchema,
	supersedeStatutoryRateSchema,
} from "@/features/payroll/services/statutory-rates.schemas";
import { dateFormat, normalizeText, toNumber } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type StatutoryRateRecord = typeof statutoryRates.$inferSelect;
type StatutoryRateStatus = "active" | "future" | "superseded";

type StatutoryRateView = {
	id: string;
	category: StatutoryRateCategoryKey;
	label: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	lowerBound: number | null;
	upperBound: number | null;
	rate: number | null;
	fixedAmount: number | null;
	notes: string | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
};

type StatutoryRateCategoryGroup = {
	category: StatutoryRateCategoryKey;
	label: string;
	description: string;
	rows: StatutoryRateView[];
	warnings: string[];
};

type CurrentStatutoryRatesResponse = {
	groupedRates: StatutoryRateCategoryGroup[];
	resolvedRates: Awaited<ReturnType<typeof resolveStatutoryRates>>;
};

type StatutoryRateMutationResponse = {
	rate: StatutoryRateView;
	warnings: string[];
};

type StatutoryRateHistoryItem = StatutoryRateView & {
	status: StatutoryRateStatus;
};

function toStatutoryRateView(row: StatutoryRateRecord): StatutoryRateView {
	return {
		id: row.id,
		category: row.category,
		label: row.label,
		effectiveFrom: row.effectiveFrom,
		effectiveTo: row.effectiveTo,
		lowerBound: toNumber(row.lowerBound),
		upperBound: toNumber(row.upperBound),
		rate: toNumber(row.rate),
		fixedAmount: toNumber(row.fixedAmount),
		notes: row.notes,
		createdBy: row.createdBy,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toRateInsertValues(payload: StatutoryRateCreatePayload, createdBy: string) {
	return {
		category: payload.category,
		label: payload.label.trim(),
		effectiveFrom: payload.effectiveFrom,
		effectiveTo: payload.effectiveTo ?? null,
		lowerBound: payload.lowerBound === null ? null : toPayrollDecimalString(payload.lowerBound),
		upperBound: payload.upperBound === null ? null : toPayrollDecimalString(payload.upperBound),
		rate: payload.rate === null ? null : Number(payload.rate).toFixed(6),
		fixedAmount: payload.fixedAmount === null ? null : toPayrollDecimalString(payload.fixedAmount),
		notes: normalizeText(payload.notes),
		createdBy,
	};
}

function buildOverlapWarnings(rows: StatutoryRateRecord[]) {
	if (
		rows.length <= 1 ||
		(STATUTORY_RATE_MULTI_ROW_CATEGORIES as readonly string[]).includes(rows[0].category)
	) {
		return [];
	}

	return [
		`Multiple overlapping rows are active for ${STATUTORY_RATE_CATEGORY_METADATA[rows[0].category].label}. The latest effective row will be used during resolution.`,
	];
}

async function getCategoryRows(category: StatutoryRateCategoryKey) {
	return db.query.statutoryRates.findMany({
		where: eq(statutoryRates.category, category),
		orderBy: [desc(statutoryRates.effectiveFrom), desc(statutoryRates.updatedAt)],
	});
}

async function getCurrentStatutoryRates(): Promise<CurrentStatutoryRatesResponse> {
	const today = dateFormat(new Date());
	const rows = await db.query.statutoryRates.findMany({
		where: and(
			lte(statutoryRates.effectiveFrom, today),
			or(isNull(statutoryRates.effectiveTo), gte(statutoryRates.effectiveTo, today))
		),
		orderBy: [
			asc(statutoryRates.category),
			desc(statutoryRates.effectiveFrom),
			asc(statutoryRates.lowerBound),
		],
	});
	const rowsByCategory = new Map<StatutoryRateCategoryKey, StatutoryRateRecord[]>();

	for (const row of rows) {
		const existing = rowsByCategory.get(row.category) ?? [];
		existing.push(row);
		rowsByCategory.set(row.category, existing);
	}

	const groupedRates = STATUTORY_RATE_CATEGORY_KEYS.map((category) => {
		const categoryRows = rowsByCategory.get(category) ?? [];
		return {
			category,
			label: STATUTORY_RATE_CATEGORY_METADATA[category].label,
			description: STATUTORY_RATE_CATEGORY_METADATA[category].description,
			rows: categoryRows.map(toStatutoryRateView),
			warnings: buildOverlapWarnings(categoryRows),
		} satisfies StatutoryRateCategoryGroup;
	}).filter((group) => group.rows.length > 0);

	return {
		groupedRates,
		resolvedRates: await resolveStatutoryRates(new Date(), db),
	};
}

async function addStatutoryRate({
	payload,
	createdBy,
}: {
	payload: StatutoryRateCreatePayload;
	createdBy: string;
}): Promise<Result<StatutoryRateMutationResponse>> {
	const warnings: string[] = [];
	const existingRows = await getCategoryRows(payload.category);

	if (existingRows.length > 0 && payload.effectiveTo) {
		for (const row of existingRows) {
			if (
				doSalaryRangesOverlap({
					existingEffectiveFrom: row.effectiveFrom,
					existingEffectiveTo: row.effectiveTo,
					newEffectiveFrom: payload.effectiveFrom,
					newEffectiveTo: payload.effectiveTo,
				})
			) {
				warnings.push(
					`This rate overlaps ${row.label} (${row.effectiveFrom} to ${row.effectiveTo ?? "open-ended"}).`
				);
				break;
			}
		}
	} else if (existingRows.length > 0 && payload.category !== "paye_band") {
		for (const row of existingRows) {
			if (
				doSalaryRangesOverlap({
					existingEffectiveFrom: row.effectiveFrom,
					existingEffectiveTo: row.effectiveTo,
					newEffectiveFrom: payload.effectiveFrom,
					newEffectiveTo: payload.effectiveTo ?? null,
				})
			) {
				warnings.push(
					`Another ${STATUTORY_RATE_CATEGORY_METADATA[payload.category].label} row overlaps this date range. Resolution will use the latest effective row.`
				);
				break;
			}
		}
	}

	try {
		const [created] = await db
			.insert(statutoryRates)
			.values(toRateInsertValues(payload, createdBy))
			.returning();

		return success({
			rate: toStatutoryRateView(created),
			warnings,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to add statutory rate",
		});
	}
}

async function supersedeStatutoryRate({
	rateId,
	effectiveTo,
}: {
	rateId: string;
	effectiveTo: string;
}): Promise<Result<StatutoryRateMutationResponse>> {
	const existing = await db.query.statutoryRates.findFirst({
		where: eq(statutoryRates.id, rateId),
	});

	if (!existing) {
		return failure({
			type: "NotFoundError",
			message: "Statutory rate not found",
		});
	}

	if (effectiveTo < existing.effectiveFrom) {
		return failure({
			type: "ValidationError",
			message: "Effective to date must be on or after the rate effective from date",
		});
	}

	try {
		const [updated] = await db
			.update(statutoryRates)
			.set({
				effectiveTo,
				updatedAt: new Date(),
			})
			.where(eq(statutoryRates.id, rateId))
			.returning();

		return success({
			rate: toStatutoryRateView(updated),
			warnings: [],
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to supersede statutory rate",
		});
	}
}

async function getStatutoryRateHistory(
	category: StatutoryRateCategoryKey
): Promise<StatutoryRateHistoryItem[]> {
	const rows = await db.query.statutoryRates.findMany({
		where: eq(statutoryRates.category, category),
		orderBy: [desc(statutoryRates.effectiveFrom), desc(statutoryRates.updatedAt)],
	});

	return rows.map((row) => ({
		...toStatutoryRateView(row),
		status: getSalaryHistoryStatus({
			effectiveFrom: row.effectiveFrom,
			effectiveTo: row.effectiveTo,
		}) as StatutoryRateStatus,
	}));
}

async function previewPayrollCalculation(payload: PayrollPreviewCalculationPayload) {
	const computationDate = payload.computationDate
		? new Date(`${payload.computationDate}T00:00:00.000Z`)
		: new Date();
	const resolvedRates = await resolveStatutoryRates(computationDate, db);

	return {
		computationDate: dateFormat(computationDate),
		resolvedRates,
		breakdown: computeFullPayrollDeductions(
			payload.grossPay,
			payload.salaryStructureComponents as PayrollPreviewSalaryStructureComponents,
			resolvedRates
		),
	};
}

async function requireStatutoryRatesViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("statutory-rates:view");
}

async function requireStatutoryRatesManageAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("statutory-rates:manage");
}

export const getCurrentStatutoryRatesFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireStatutoryRatesViewAccess();
		return getCurrentStatutoryRates();
	});

export const addStatutoryRateFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(statutoryRateCreateSchema)
	.handler(async ({ data, context }) => {
		await requireStatutoryRatesManageAccess();
		const result = await addStatutoryRate({
			payload: data,
			createdBy: context.user.id,
		});

		if (result.success) {
			await logActivity({
				data: {
					action: "add statutory rate",
					description: `Added ${STATUTORY_RATE_CATEGORY_METADATA[data.category].label} rate effective ${data.effectiveFrom}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const supersedeStatutoryRateFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(supersedeStatutoryRateSchema)
	.handler(async ({ data, context }) => {
		await requireStatutoryRatesManageAccess();
		const result = await supersedeStatutoryRate(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "supersede statutory rate",
					description: `Closed statutory rate ${data.rateId} effective ${data.effectiveTo}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const getStatutoryRateHistoryFn = createServerFn()
	.middleware([authMiddleware])
	.validator(statutoryRateHistorySchema)
	.handler(async ({ data }) => {
		await requireStatutoryRatesViewAccess();
		return getStatutoryRateHistory(data.category);
	});

export const previewPayrollCalculationFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(previewPayrollCalculationSchema)
	.handler(async ({ data }) => {
		await requireStatutoryRatesViewAccess();
		return previewPayrollCalculation(data);
	});

export type CurrentStatutoryRatesView = Awaited<ReturnType<typeof getCurrentStatutoryRatesFn>>;
export type CurrentStatutoryRateGroup = CurrentStatutoryRatesView["groupedRates"][number];
export type StatutoryRateViewItem = CurrentStatutoryRateGroup["rows"][number];
export type StatutoryRateHistoryView = Awaited<ReturnType<typeof getStatutoryRateHistoryFn>>;
export type StatutoryRateHistoryViewItem = StatutoryRateHistoryView[number];
export type PayrollCalculationPreview = Awaited<ReturnType<typeof previewPayrollCalculationFn>>;
