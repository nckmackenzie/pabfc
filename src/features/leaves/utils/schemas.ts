import { LEAVE_STATUS, LEAVE_TYPES } from "@/drizzle/schema";
import { dateSchema } from "@/lib/schema-rules";
import { z } from "zod";

export const leaveTypeSchema = z.enum(LEAVE_TYPES);
export const leaveStatusSchema = z.enum(LEAVE_STATUS);
export const leaveYearSchema = z.coerce
  .number()
  .int()
  .min(2000)
  .max(9999, "Leave year must be between 2000 and 9999");
export const employeeIdSchema = z.string().trim().min(1, "Employee is required");

export const leaveRequestListFilterSchema = z.object({
  q: z.string().trim().optional().catch(""),
  status: leaveStatusSchema.optional().catch(undefined),
  leaveType: leaveTypeSchema.optional().catch(undefined),
  year: leaveYearSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const effectiveBalanceCheckSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required"),
  leaveType: leaveTypeSchema,
  leaveYear: z.coerce
    .number()
    .int()
    .min(2000)
    .max(9999, "Leave year must be between 2000 and 9999"),
  excludeRequestId: z.string().trim().optional(),
});

export const leaveRequestSchema = z
  .object({
    id: z.string().trim().optional(),
    employeeId: z.string().trim().min(1, "Employee is required"),
    leaveType: leaveTypeSchema,
    startDate: dateSchema("Start date is required"),
    endDate: dateSchema("End date is required"),
    reason: z.string().trim().max(2000).nullish(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate > data.endDate) {
      ctx.addIssue({
        code: "custom",
        message: "Start date cannot be after end date",
      });
    }
  });

export const employeeLeaveTypeSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee is required"),
  leaveType: leaveTypeSchema,
});

export const leaveBalanceViewSchema = z.object({
  employeeId: employeeIdSchema.catch(""),
  leaveYear: leaveYearSchema.optional().catch(new Date().getFullYear()),
});

export const leaveBalanceAdjustmentSchema = z.object({
  employeeId: employeeIdSchema,
  leaveType: leaveTypeSchema,
  leaveYear: leaveYearSchema,
  adjustmentDays: z.coerce.number(),
  reason: z.string().trim().min(1, "Reason is required"),
});

export type LeaveRequestListFilters = z.infer<typeof leaveRequestListFilterSchema>;
export type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;
export type LeaveBalanceViewParams = z.infer<typeof leaveBalanceViewSchema>;
