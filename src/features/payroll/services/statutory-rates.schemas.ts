import { z } from "zod";
import {
	STATUTORY_RATE_CATEGORIES,
	STATUTORY_RATE_CATEGORY_METADATA,
	type StatutoryRateCategory,
} from "@/features/payroll/lib/payroll-constants";
import { dateSchema } from "@/lib/schema-rules";

const statutoryRateCategoryValues = STATUTORY_RATE_CATEGORIES as unknown as [
	StatutoryRateCategory,
	...Array<StatutoryRateCategory>,
];

const optionalCurrencyField = (label: string) =>
	z
		.number({ error: `${label} must be a number` })
		.nullable()
		.refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
			message: `${label} must be zero or greater`,
		});

const optionalRateField = (label: string) =>
	z
		.number({ error: `${label} must be a number` })
		.nullable()
		.refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
			message: `${label} must be zero or greater`,
		});

export const statutoryRateCategorySchema = z.enum(statutoryRateCategoryValues, {
	error: "Select a statutory rate category",
});

export const statutoryRateIdSchema = z.string().trim().min(1, "Statutory rate is required");

export const statutoryRateCreateSchema = z
	.object({
		category: statutoryRateCategorySchema,
		label: z.string().trim().min(1, "Label is required").max(100, {
			message: "Label must be 100 characters or less",
		}),
		effectiveFrom: dateSchema("Effective from date is required"),
		effectiveTo: dateSchema("Invalid effective to date").nullable(),
		lowerBound: optionalCurrencyField("Lower bound"),
		upperBound: optionalCurrencyField("Upper bound"),
		rate: optionalRateField("Rate"),
		fixedAmount: optionalCurrencyField("Fixed amount"),
		notes: z
			.string()
			.trim()
			.max(5000, { message: "Notes must be 5000 characters or less" })
			.nullable(),
	})
	.superRefine((data, ctx) => {
		if (data.effectiveTo && data.effectiveTo <= data.effectiveFrom) {
			ctx.addIssue({
				code: "custom",
				message: "Effective to date must be after effective from date",
				path: ["effectiveTo"],
			});
		}

		if (data.rate === null && data.fixedAmount === null) {
			ctx.addIssue({
				code: "custom",
				message: "Provide a rate, a fixed amount, or both",
				path: ["rate"],
			});
		}

		if (data.lowerBound !== null && data.upperBound !== null && data.upperBound < data.lowerBound) {
			ctx.addIssue({
				code: "custom",
				message: "Upper bound must be greater than or equal to lower bound",
				path: ["upperBound"],
			});
		}

		const metadata = STATUTORY_RATE_CATEGORY_METADATA[data.category];

		if (metadata.valueType === "band") {
			if (data.lowerBound === null) {
				ctx.addIssue({
					code: "custom",
					message: "Lower bound is required for PAYE bands",
					path: ["lowerBound"],
				});
			}

			if (data.rate === null) {
				ctx.addIssue({
					code: "custom",
					message: "Rate is required for PAYE bands",
					path: ["rate"],
				});
			}
		}

		if (metadata.valueType === "fixed" && data.fixedAmount === null) {
			ctx.addIssue({
				code: "custom",
				message: "Fixed amount is required for this category",
				path: ["fixedAmount"],
			});
		}

		if (metadata.valueType === "rate" && data.rate === null) {
			ctx.addIssue({
				code: "custom",
				message: "Rate is required for this category",
				path: ["rate"],
			});
		}
	});

export const supersedeStatutoryRateSchema = z.object({
	rateId: statutoryRateIdSchema,
	effectiveTo: dateSchema("Effective to date is required"),
});

export const statutoryRateHistorySchema = z.object({
	category: statutoryRateCategorySchema,
});

export const previewPayrollCalculationSchema = z.object({
	grossPay: z
		.number({ error: "Gross pay must be a number" })
		.refine((value) => Number.isFinite(value) && value >= 0, {
			message: "Gross pay must be zero or greater",
		}),
	computationDate: dateSchema("Invalid computation date").optional(),
	salaryStructureComponents: z.object({
		pensionEmployeeContribution: optionalCurrencyField("Employee pension contribution"),
		pensionEmployerContribution: optionalCurrencyField("Employer pension contribution"),
		mortgageInterestMonthly: optionalCurrencyField("Mortgage interest"),
		postRetirementMedicalMonthly: optionalCurrencyField("Post-retirement medical"),
		insurancePremiumsMonthly: optionalCurrencyField("Insurance premiums"),
		mealAllowance: optionalCurrencyField("Meal allowance"),
		airtimeAllowance: optionalCurrencyField("Airtime allowance"),
	}),
});

export type StatutoryRateCreatePayload = z.infer<typeof statutoryRateCreateSchema>;
export type PayrollPreviewCalculationPayload = z.infer<typeof previewPayrollCalculationSchema>;
export type SupersedeStatutoryRatePayload = z.infer<typeof supersedeStatutoryRateSchema>;
