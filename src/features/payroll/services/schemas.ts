import { z } from "zod";
import { PAY_FREQUENCIES } from "@/drizzle/schema";
import {
	SALARY_STRUCTURE_FINANCIAL_FIELDS,
	SALARY_STRUCTURE_METADATA_FIELDS,
} from "@/features/payroll/lib/payroll-constants";
import {
	dateSchema,
	nullableNonNegativeNumberField,
	nullableTrimmedString,
	searchValidateSchema,
} from "@/lib/schema-rules";

export const salaryStructureIdSchema = z.string().refine((value) => value.length > 0, {
	error: "Salary structure is required",
});

export const employeeIdSchema = z.string().trim().min(1, "Employee is required");

export const salaryStructureCreateSchema = z
	.object({
		id: z.undefined().optional(),
		employeeId: employeeIdSchema,
		effectiveFrom: dateSchema("Effective from date is required"),
		effectiveTo: dateSchema("Invalid effective to date").nullable(),
		payFrequency: z.enum(PAY_FREQUENCIES, {
			error: "Select pay frequency",
		}),
		basicSalary: z.number({ error: "Basic salary must be a number" }),
		houseAllowance: nullableNonNegativeNumberField("House allowance"),
		transportAllowance: nullableNonNegativeNumberField("Transport allowance"),
		commuterAllowance: nullableNonNegativeNumberField("Commuter allowance"),
		mealAllowance: nullableNonNegativeNumberField("Meal allowance"),
		airtimeAllowance: nullableNonNegativeNumberField("Airtime allowance"),
		otherAllowances: nullableNonNegativeNumberField("Other allowances"),
		otherAllowancesDescription: nullableTrimmedString,
		pensionEmployeeContribution: nullableNonNegativeNumberField("Employee pension contribution"),
		pensionEmployerContribution: nullableNonNegativeNumberField("Employer pension contribution"),
		pensionFundName: nullableTrimmedString,
		mortgageInterestMonthly: nullableNonNegativeNumberField("Mortgage interest"),
		postRetirementMedicalMonthly: nullableNonNegativeNumberField(
			"Post-retirement medical contribution"
		),
		insurancePremiumsMonthly: nullableNonNegativeNumberField("Insurance premiums"),
		hasHelbLoan: z.boolean(),
		helbMonthlyDeduction: nullableNonNegativeNumberField("HELB deduction"),
		normalHoursPerDay: z
			.number({ error: "Normal hours per day must be a number" })
			.refine((value) => Number.isFinite(value) && value > 0, {
				message: "Normal hours per day must be greater than zero",
			}),
		normalDaysPerWeek: z
			.number({ error: "Normal days per week must be a number" })
			.refine((value) => Number.isFinite(value) && value > 0, {
				message: "Normal days per week must be greater than zero",
			}),
		overtimeHourlyRateDivisor: z
			.number({ error: "Overtime divisor must be a number" })
			.int("Overtime divisor must be a whole number")
			.refine((value) => Number.isFinite(value) && value > 0, {
				message: "Overtime divisor must be greater than zero",
			}),
		notes: nullableTrimmedString,
	})
	.superRefine((data, ctx) => {
		if (data.basicSalary <= 0) {
			ctx.addIssue({
				code: "custom",
				message: "Basic salary must be greater than zero",
				path: ["basicSalary"],
			});
		}

		if (data.effectiveTo && data.effectiveTo <= data.effectiveFrom) {
			ctx.addIssue({
				code: "custom",
				message: "Effective to date must be after effective from date",
				path: ["effectiveTo"],
			});
		}

		if (data.hasHelbLoan && (data.helbMonthlyDeduction ?? 0) <= 0) {
			ctx.addIssue({
				code: "custom",
				message: "HELB deduction must be greater than zero when a HELB loan is enabled",
				path: ["helbMonthlyDeduction"],
			});
		}
	});

export const salaryStructureCreateRequestSchema = salaryStructureCreateSchema;

export const salaryStructureMetadataUpdateSchema = z
	.object({
		notes: nullableTrimmedString,
		pensionFundName: nullableTrimmedString,
		otherAllowancesDescription: nullableTrimmedString,
	})
	.passthrough();

export const salaryStructureUpdateRequestSchema = z.object({
	structureId: salaryStructureIdSchema,
	payload: salaryStructureMetadataUpdateSchema,
});

export const salaryStructureDeactivateSchema = z.object({
	structureId: salaryStructureIdSchema,
	effectiveTo: dateSchema("Effective to date is required"),
});

export const salaryHistoryParamsSchema = z.object({
	employeeId: employeeIdSchema,
});

export const salaryStructurePeriodLookupSchema = z.object({
	employeeId: employeeIdSchema,
	periodDate: dateSchema("Period date is required"),
});

export const salaryStructureDetailParamsSchema = z.object({
	structureId: salaryStructureIdSchema,
});

export const salaryStructureDirectoryFilterSchema = searchValidateSchema;

export const salaryStructureEmployeeSummarySchema = z.object({
	employeeId: employeeIdSchema,
});

export const salaryStructureCreatePrefillSearchSchema = z.object({
	employeeId: z.string().optional().catch(""),
});

export function getForbiddenSalaryStructureUpdateFields(payload: Record<string, unknown>) {
	return SALARY_STRUCTURE_FINANCIAL_FIELDS.filter((field) =>
		Object.prototype.hasOwnProperty.call(payload, field)
	);
}

export function pickSalaryStructureMetadataPayload(
	payload: z.infer<typeof salaryStructureMetadataUpdateSchema>
) {
	const metadata = {} as Record<(typeof SALARY_STRUCTURE_METADATA_FIELDS)[number], unknown>;

	for (const field of SALARY_STRUCTURE_METADATA_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(payload, field)) {
			metadata[field] = payload[field];
		}
	}

	return metadata;
}

export type SalaryStructureCreateFormInput = z.infer<typeof salaryStructureCreateSchema>;
