import { z } from "zod";
import { OVERTIME_STATUS } from "@/features/payroll/lib/payroll-constants";
import { nullableTrimmedString, requiredNumberSchemaEntry } from "@/lib/schema-rules";

const overtimeStatusValues = [
	OVERTIME_STATUS.DRAFT,
	OVERTIME_STATUS.APPROVED,
	OVERTIME_STATUS.PAID,
] as const;

export const overtimeRecordIdSchema = z.string().trim().min(1, "Overtime record is required");
export const overtimeEmployeeIdSchema = z.string().trim().min(1, "Employee is required");
export const overtimeStatusSchema = z.enum(overtimeStatusValues);

export const overtimeRecordCreateSchema = z
	.object({
		id: z.string().optional(),
		employeeId: overtimeEmployeeIdSchema,
		periodMonth: z.coerce.number({
			error: "Period month must be a number",
		}),
		periodYear: z.coerce.number({
			error: "Period year must be a number",
		}),
		weekdayOvertimeHours: requiredNumberSchemaEntry(),
		weekendOvertimeHours: requiredNumberSchemaEntry(),
		publicHolidayOvertimeHours: requiredNumberSchemaEntry(),
		notes: nullableTrimmedString,
	})
	.superRefine((value, ctx) => {
		if (!Number.isInteger(value.periodMonth) || value.periodMonth < 1 || value.periodMonth > 12) {
			ctx.addIssue({
				code: "custom",
				path: ["periodMonth"],
				message: "Period month must be between 1 and 12",
			});
		}

		if (!Number.isInteger(value.periodYear) || value.periodYear < 2000 || value.periodYear > 2100) {
			ctx.addIssue({
				code: "custom",
				path: ["periodYear"],
				message: "Period year must be between 2000 and 2100",
			});
		}

		if (
			value.weekdayOvertimeHours === 0 &&
			value.weekendOvertimeHours === 0 &&
			value.publicHolidayOvertimeHours === 0
		) {
			ctx.addIssue({
				code: "custom",
				path: ["weekdayOvertimeHours"],
				message: "Enter at least one overtime hour value",
			});
		}
	});

export const overtimeRecordCreateFormSchema = z
	.object({
		id: z.string().optional(),
		employeeId: overtimeEmployeeIdSchema,
		periodMonth: z.number({
			error: "Period month must be a number",
		}),
		periodYear: z.number({
			error: "Period year must be a number",
		}),
		weekdayOvertimeHours: requiredNumberSchemaEntry(),
		weekendOvertimeHours: requiredNumberSchemaEntry(),
		publicHolidayOvertimeHours: requiredNumberSchemaEntry(),
		notes: z
			.string()
			.trim()
			.max(5000, { message: "Notes must be 5000 characters or less" })
			.nullable(),
	})
	.superRefine((value, ctx) => {
		if (!Number.isInteger(value.periodMonth) || value.periodMonth < 1 || value.periodMonth > 12) {
			ctx.addIssue({
				code: "custom",
				path: ["periodMonth"],
				message: "Period month must be between 1 and 12",
			});
		}

		if (!Number.isInteger(value.periodYear) || value.periodYear < 2000 || value.periodYear > 2100) {
			ctx.addIssue({
				code: "custom",
				path: ["periodYear"],
				message: "Period year must be between 2000 and 2100",
			});
		}

		if (
			value.weekdayOvertimeHours === 0 &&
			value.weekendOvertimeHours === 0 &&
			value.publicHolidayOvertimeHours === 0
		) {
			ctx.addIssue({
				code: "custom",
				path: ["weekdayOvertimeHours"],
				message: "Enter at least one overtime hour value",
			});
		}
	});

export const overtimeRecordUpdatePayloadSchema = z
	.object({
		id: z.string().optional(),
		weekdayOvertimeHours: requiredNumberSchemaEntry("Weekday overtime hours"),
		weekendOvertimeHours: requiredNumberSchemaEntry("Weekend overtime hours"),
		publicHolidayOvertimeHours: requiredNumberSchemaEntry("Public holiday overtime hours"),
		notes: nullableTrimmedString,
	})
	.superRefine((value, ctx) => {
		if (
			value.weekdayOvertimeHours === 0 &&
			value.weekendOvertimeHours === 0 &&
			value.publicHolidayOvertimeHours === 0
		) {
			ctx.addIssue({
				code: "custom",
				path: ["weekdayOvertimeHours"],
				message: "Enter at least one overtime hour value",
			});
		}
	});

export const overtimeRecordCreateRequestSchema = overtimeRecordCreateSchema;

export const overtimeRecordUpdateFormSchema = z
	.object({
		id: z.string().min(1, "Overtime record is required"),
		weekdayOvertimeHours: z.number({
			error: "Weekday overtime hours must be a number",
		}),
		weekendOvertimeHours: z.number({
			error: "Weekend overtime hours must be a number",
		}),
		publicHolidayOvertimeHours: z.number({
			error: "Public holiday overtime hours must be a number",
		}),
		notes: z
			.string()
			.trim()
			.max(5000, { message: "Notes must be 5000 characters or less" })
			.nullable(),
	})
	.superRefine((value, ctx) => {
		if (
			value.weekdayOvertimeHours < 0 ||
			value.weekendOvertimeHours < 0 ||
			value.publicHolidayOvertimeHours < 0
		) {
			ctx.addIssue({
				code: "custom",
				path: ["weekdayOvertimeHours"],
				message: "Overtime hours must be zero or greater",
			});
		}

		if (
			value.weekdayOvertimeHours === 0 &&
			value.weekendOvertimeHours === 0 &&
			value.publicHolidayOvertimeHours === 0
		) {
			ctx.addIssue({
				code: "custom",
				path: ["weekdayOvertimeHours"],
				message: "Enter at least one overtime hour value",
			});
		}
	});

export const overtimeRecordUpdateRequestSchema = z.object({
	recordId: overtimeRecordIdSchema,
	payload: overtimeRecordUpdatePayloadSchema,
});

export const overtimeRecordPeriodSearchSchema = z.object({
	q: z.string().optional().catch(""),
	periodMonth: z.coerce.number().int().min(1).max(12),
	periodYear: z.coerce.number().int().min(2000).max(2100),
	status: overtimeStatusSchema.optional().catch(undefined),
	departmentId: z.coerce.number().int().positive().optional().catch(undefined),
});

export const overtimeRecordByEmployeePeriodSchema = z.object({
	employeeId: overtimeEmployeeIdSchema,
	periodMonth: z.coerce.number().int().min(1).max(12),
	periodYear: z.coerce.number().int().min(2000).max(2100),
});

export const overtimeRecordPeriodSchema = z.object({
	periodMonth: z.coerce.number().int().min(1).max(12),
	periodYear: z.coerce.number().int().min(2000).max(2100),
});

export const overtimeRecordStatusActionSchema = z.object({
	recordId: overtimeRecordIdSchema,
});

export const overtimeRecordDeleteSchema = overtimeRecordIdSchema;

export const overtimeRecordByIdSchema = z.object({
	recordId: overtimeRecordIdSchema,
});

export const overtimeSummaryRangeSchema = z
	.object({
		employeeId: overtimeEmployeeIdSchema,
		fromMonth: z.coerce.number().int().min(1).max(12),
		fromYear: z.coerce.number().int().min(2000).max(2100),
		toMonth: z.coerce.number().int().min(1).max(12),
		toYear: z.coerce.number().int().min(2000).max(2100),
	})
	.superRefine((value, ctx) => {
		const fromIndex = value.fromYear * 100 + value.fromMonth;
		const toIndex = value.toYear * 100 + value.toMonth;

		if (fromIndex > toIndex) {
			ctx.addIssue({
				code: "custom",
				path: ["fromMonth"],
				message: "From period cannot be after to period",
			});
		}
	});

export const overtimePayrollLinkSchema = z.object({
	recordId: overtimeRecordIdSchema,
	payrollSlipId: z.string().trim().min(1, "Payroll slip is required"),
});

export type OvertimeRecordCreateFormInput = z.infer<typeof overtimeRecordCreateSchema>;
export type OvertimeRecordUpdatePayload = z.infer<typeof overtimeRecordUpdatePayloadSchema>;
