import { z } from "zod";
import {
	PAYROLL_ACCOUNT_ROLE_KEYS,
	type PayrollAccountRole,
} from "@/features/payroll/lib/payroll-constants";

const payrollAccountRoleValues = PAYROLL_ACCOUNT_ROLE_KEYS as [
	PayrollAccountRole,
	...Array<PayrollAccountRole>,
];

const optionalDescriptionField = z
	.string()
	.trim()
	.max(5000, { message: "Description must be 5000 characters or less" })
	.nullable();

export const payrollAccountRoleSchema = z.enum(payrollAccountRoleValues, {
	error: "Select a payroll account role",
});

export const updatePayrollAccountMappingSchema = z.object({
	id: z.string().optional(),
	role: payrollAccountRoleSchema,
	accountId: z.coerce
		.number({ error: "Select a ledger account" })
		.int("Select a valid ledger account")
		.positive("Select a valid ledger account"),
	description: optionalDescriptionField,
});

export const payrollAccountMappingFormSchema = z.object({
	id: z.string().optional(),
	role: payrollAccountRoleSchema,
	accountId: z.string().trim().min(1, "Select a ledger account"),
	description: z
		.string()
		.trim()
		.max(5000, { message: "Description must be 5000 characters or less" }),
});

export type PayrollAccountMappingFormValues = z.infer<
	typeof payrollAccountMappingFormSchema
>;
