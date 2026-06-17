import { and, asc, desc, gte, isNull, lte, or } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { db } from "@/drizzle/db";
import type * as schema from "@/drizzle/schema";
import { dateFormat } from "@/lib/helpers";
import {
	STATUTORY_RATE_DEFAULTS,
	STATUTORY_RATE_MULTI_ROW_CATEGORIES,
	type StatutoryRateCategory,
} from "@/features/payroll/lib/payroll-constants";
import { statutoryRates } from "@/drizzle/schema";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

export type PayrollDbClient = typeof db | Transaction;

type StatutoryRateRecord = typeof statutoryRates.$inferSelect;
type ResolvedFromValue = "database" | "constant";

export type ResolvedStatutoryRates = {
	payeBands: Array<{
		lowerBound: number;
		upperBound: number | null;
		rate: number;
	}>;
	personalRelief: number;
	insuranceReliefRate: number;
	insuranceReliefMax: number;
	pensionAllowableMax: number;
	mortgageAllowableMax: number;
	postRetirementMedicalMax: number;
	nonCashBenefitExempt: number;
	mealAllowanceExempt: number;
	nssfTier1UpperLimit: number;
	nssfTier2UpperLimit: number;
	nssfContributionRate: number;
	nssfMaxEmployee: number;
	nssfMaxEmployer: number;
	shifRate: number;
	shifMinimum: number;
	ahlEmployeeRate: number;
	ahlEmployerRate: number;
	nitaLevyPerEmployee: number;
	resolvedFrom: Record<string, ResolvedFromValue>;
};

function toStatutoryNumber(value: string | number | null | undefined) {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const parsed = Number.parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : null;
}

function groupRowsByCategory(rows: StatutoryRateRecord[]) {
	const grouped = new Map<StatutoryRateCategory, StatutoryRateRecord[]>();

	for (const row of rows) {
		const existing = grouped.get(row.category) ?? [];
		existing.push(row);
		grouped.set(row.category, existing);
	}

	return grouped;
}

function getSingleRow(
	rowsByCategory: Map<StatutoryRateCategory, StatutoryRateRecord[]>,
	category: StatutoryRateCategory
) {
	return rowsByCategory.get(category)?.[0] ?? null;
}

function resolveFixedAmount(
	rowsByCategory: Map<StatutoryRateCategory, StatutoryRateRecord[]>,
	category: StatutoryRateCategory,
	fallback: number
) {
	const row = getSingleRow(rowsByCategory, category);
	const value = toStatutoryNumber(row?.fixedAmount);

	return {
		value: value ?? fallback,
		source: value === null ? ("constant" as const) : ("database" as const),
	};
}

function resolveRate(
	rowsByCategory: Map<StatutoryRateCategory, StatutoryRateRecord[]>,
	category: StatutoryRateCategory,
	fallback: number
) {
	const row = getSingleRow(rowsByCategory, category);
	const value = toStatutoryNumber(row?.rate);

	return {
		value: value ?? fallback,
		source: value === null ? ("constant" as const) : ("database" as const),
	};
}

function buildConstantResolvedRates(): ResolvedStatutoryRates {
	return {
		payeBands: STATUTORY_RATE_DEFAULTS.paye.bands.map((band) => ({
			lowerBound: band.lowerBound,
			upperBound: band.upperBound,
			rate: band.rate,
		})),
		personalRelief: STATUTORY_RATE_DEFAULTS.paye.personalRelief,
		insuranceReliefRate: STATUTORY_RATE_DEFAULTS.paye.insuranceReliefRate,
		insuranceReliefMax: STATUTORY_RATE_DEFAULTS.paye.insuranceReliefMax,
		pensionAllowableMax: STATUTORY_RATE_DEFAULTS.paye.pensionAllowableMax,
		mortgageAllowableMax: STATUTORY_RATE_DEFAULTS.paye.mortgageAllowableMax,
		postRetirementMedicalMax: STATUTORY_RATE_DEFAULTS.paye.postRetirementMedicalMax,
		nonCashBenefitExempt: STATUTORY_RATE_DEFAULTS.paye.nonCashBenefitExempt,
		mealAllowanceExempt: STATUTORY_RATE_DEFAULTS.paye.mealAllowanceExempt,
		nssfTier1UpperLimit: STATUTORY_RATE_DEFAULTS.nssf.tier1UpperLimit,
		nssfTier2UpperLimit: STATUTORY_RATE_DEFAULTS.nssf.tier2UpperLimit,
		nssfContributionRate: STATUTORY_RATE_DEFAULTS.nssf.contributionRate,
		nssfMaxEmployee: STATUTORY_RATE_DEFAULTS.nssf.maxEmployee,
		nssfMaxEmployer: STATUTORY_RATE_DEFAULTS.nssf.maxEmployer,
		shifRate: STATUTORY_RATE_DEFAULTS.shif.rate,
		shifMinimum: STATUTORY_RATE_DEFAULTS.shif.minimumContribution,
		ahlEmployeeRate: STATUTORY_RATE_DEFAULTS.ahl.employeeRate,
		ahlEmployerRate: STATUTORY_RATE_DEFAULTS.ahl.employerRate,
		nitaLevyPerEmployee: STATUTORY_RATE_DEFAULTS.nita.levyPerEmployee,
		resolvedFrom: {
			payeBands: "constant",
			personalRelief: "constant",
			insuranceReliefRate: "constant",
			insuranceReliefMax: "constant",
			pensionAllowableMax: "constant",
			mortgageAllowableMax: "constant",
			postRetirementMedicalMax: "constant",
			nonCashBenefitExempt: "constant",
			mealAllowanceExempt: "constant",
			nssfTier1UpperLimit: "constant",
			nssfTier2UpperLimit: "constant",
			nssfContributionRate: "constant",
			nssfMaxEmployee: "constant",
			nssfMaxEmployer: "constant",
			shifRate: "constant",
			shifMinimum: "constant",
			ahlEmployeeRate: "constant",
			ahlEmployerRate: "constant",
			nitaLevyPerEmployee: "constant",
		},
	};
}

function hasContiguousPayeBandSchedule(rows: StatutoryRateRecord[]) {
	if (rows.length === 0) {
		return false;
	}

	for (let index = 1; index < rows.length; index += 1) {
		const previousUpperBound = toStatutoryNumber(rows[index - 1]?.upperBound);
		const currentLowerBound = toStatutoryNumber(rows[index]?.lowerBound);

		if (previousUpperBound === null || currentLowerBound === null) {
			return false;
		}

		if (currentLowerBound > previousUpperBound + 1) {
			return false;
		}
	}

	return true;
}

export async function resolveStatutoryRates(
	computationDate: Date,
	dbClient: PayrollDbClient
): Promise<ResolvedStatutoryRates> {
	const computationDateValue = dateFormat(computationDate);
	const activeRows = await dbClient.query.statutoryRates.findMany({
		where: and(
			lte(statutoryRates.effectiveFrom, computationDateValue),
			or(isNull(statutoryRates.effectiveTo), gte(statutoryRates.effectiveTo, computationDateValue))
		),
		orderBy: [
			asc(statutoryRates.category),
			desc(statutoryRates.effectiveFrom),
			desc(statutoryRates.updatedAt),
			asc(statutoryRates.lowerBound),
		],
	});
	const rowsByCategory = groupRowsByCategory(activeRows);
	const defaults = buildConstantResolvedRates();

	const activePayeBandRows = rowsByCategory.get("paye_band") ?? [];
	const latestPayeEffectiveFrom = activePayeBandRows[0]?.effectiveFrom ?? null;
	const payeBandRows = activePayeBandRows
		.filter((row) => row.effectiveFrom === latestPayeEffectiveFrom)
		.filter((row) => {
			const lowerBound = toStatutoryNumber(row.lowerBound);
			const rate = toStatutoryNumber(row.rate);

			return lowerBound !== null && rate !== null;
		})
		.sort((left, right) => {
			const leftLowerBound = toStatutoryNumber(left.lowerBound) ?? 0;
			const rightLowerBound = toStatutoryNumber(right.lowerBound) ?? 0;
			return leftLowerBound - rightLowerBound;
		});
	const validPayeBandRows = hasContiguousPayeBandSchedule(payeBandRows)
		? payeBandRows
		: [];

	const shifRow = getSingleRow(rowsByCategory, "shif");
	const insuranceReliefRow = getSingleRow(rowsByCategory, "insurance_relief");

	const personalRelief = resolveFixedAmount(
		rowsByCategory,
		"personal_relief",
		defaults.personalRelief
	);
	const pensionAllowableMax = resolveFixedAmount(
		rowsByCategory,
		"pension_cap",
		defaults.pensionAllowableMax
	);
	const mortgageAllowableMax = resolveFixedAmount(
		rowsByCategory,
		"mortgage_cap",
		defaults.mortgageAllowableMax
	);
	const postRetirementMedicalMax = resolveFixedAmount(
		rowsByCategory,
		"post_retirement_medical_cap",
		defaults.postRetirementMedicalMax
	);
	const nonCashBenefitExempt = resolveFixedAmount(
		rowsByCategory,
		"non_cash_benefit_exempt",
		defaults.nonCashBenefitExempt
	);
	const mealAllowanceExempt = resolveFixedAmount(
		rowsByCategory,
		"meal_allowance_exempt",
		defaults.mealAllowanceExempt
	);
	const nssfTier1UpperLimit = resolveFixedAmount(
		rowsByCategory,
		"nssf_tier_1_upper_limit",
		defaults.nssfTier1UpperLimit
	);
	const nssfTier2UpperLimit = resolveFixedAmount(
		rowsByCategory,
		"nssf_tier_2_upper_limit",
		defaults.nssfTier2UpperLimit
	);
	const nssfContributionRate = resolveRate(
		rowsByCategory,
		"nssf_contribution_rate",
		defaults.nssfContributionRate
	);
	const nssfMaxEmployee = resolveFixedAmount(
		rowsByCategory,
		"nssf_max_employee",
		defaults.nssfMaxEmployee
	);
	const nssfMaxEmployer = resolveFixedAmount(
		rowsByCategory,
		"nssf_max_employer",
		defaults.nssfMaxEmployer
	);
	const ahlEmployeeRate = resolveRate(
		rowsByCategory,
		"ahl_employee_rate",
		defaults.ahlEmployeeRate
	);
	const ahlEmployerRate = resolveRate(
		rowsByCategory,
		"ahl_employer_rate",
		defaults.ahlEmployerRate
	);
	const nitaLevyPerEmployee = resolveFixedAmount(
		rowsByCategory,
		"nita",
		defaults.nitaLevyPerEmployee
	);

	const shifRateValue = toStatutoryNumber(shifRow?.rate);
	const shifMinimumValue = toStatutoryNumber(shifRow?.fixedAmount);
	const insuranceReliefRateValue = toStatutoryNumber(insuranceReliefRow?.rate);
	const insuranceReliefMaxValue = toStatutoryNumber(insuranceReliefRow?.fixedAmount);

	return {
		payeBands:
			validPayeBandRows.length > 0
				? validPayeBandRows.map((row) => ({
						lowerBound: toStatutoryNumber(row.lowerBound) ?? 0,
						upperBound: toStatutoryNumber(row.upperBound),
						rate: toStatutoryNumber(row.rate) ?? 0,
					}))
				: defaults.payeBands,
		personalRelief: personalRelief.value,
		insuranceReliefRate: insuranceReliefRateValue ?? defaults.insuranceReliefRate,
		insuranceReliefMax: insuranceReliefMaxValue ?? defaults.insuranceReliefMax,
		pensionAllowableMax: pensionAllowableMax.value,
		mortgageAllowableMax: mortgageAllowableMax.value,
		postRetirementMedicalMax: postRetirementMedicalMax.value,
		nonCashBenefitExempt: nonCashBenefitExempt.value,
		mealAllowanceExempt: mealAllowanceExempt.value,
		nssfTier1UpperLimit: nssfTier1UpperLimit.value,
		nssfTier2UpperLimit: nssfTier2UpperLimit.value,
		nssfContributionRate: nssfContributionRate.value,
		nssfMaxEmployee: nssfMaxEmployee.value,
		nssfMaxEmployer: nssfMaxEmployer.value,
		shifRate: shifRateValue ?? defaults.shifRate,
		shifMinimum: shifMinimumValue ?? defaults.shifMinimum,
		ahlEmployeeRate: ahlEmployeeRate.value,
		ahlEmployerRate: ahlEmployerRate.value,
		nitaLevyPerEmployee: nitaLevyPerEmployee.value,
		resolvedFrom: {
			payeBands: validPayeBandRows.length > 0 ? "database" : "constant",
			personalRelief: personalRelief.source,
			insuranceReliefRate: insuranceReliefRateValue === null ? "constant" : "database",
			insuranceReliefMax: insuranceReliefMaxValue === null ? "constant" : "database",
			pensionAllowableMax: pensionAllowableMax.source,
			mortgageAllowableMax: mortgageAllowableMax.source,
			postRetirementMedicalMax: postRetirementMedicalMax.source,
			nonCashBenefitExempt: nonCashBenefitExempt.source,
			mealAllowanceExempt: mealAllowanceExempt.source,
			nssfTier1UpperLimit: nssfTier1UpperLimit.source,
			nssfTier2UpperLimit: nssfTier2UpperLimit.source,
			nssfContributionRate: nssfContributionRate.source,
			nssfMaxEmployee: nssfMaxEmployee.source,
			nssfMaxEmployer: nssfMaxEmployer.source,
			shifRate: shifRateValue === null ? "constant" : "database",
			shifMinimum: shifMinimumValue === null ? "constant" : "database",
			ahlEmployeeRate: ahlEmployeeRate.source,
			ahlEmployerRate: ahlEmployerRate.source,
			nitaLevyPerEmployee: nitaLevyPerEmployee.source,
		},
	};
}

export function resolveStatutoryRatesSync(_computationDate: Date): ResolvedStatutoryRates {
	return buildConstantResolvedRates();
}

export function isMultiRowStatutoryRateCategory(category: StatutoryRateCategory) {
	return (STATUTORY_RATE_MULTI_ROW_CATEGORIES as readonly string[]).includes(category);
}
