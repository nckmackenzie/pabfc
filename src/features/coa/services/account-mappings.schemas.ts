import { z } from "zod";
import {
	LEDGER_ACCOUNT_ROLE_KEYS,
	type LedgerAccountRole,
} from "@/features/coa/lib/account-roles";

const ledgerAccountRoleValues = LEDGER_ACCOUNT_ROLE_KEYS as [
	LedgerAccountRole,
	...Array<LedgerAccountRole>,
];

export const ledgerAccountRoleSchema = z.enum(ledgerAccountRoleValues, {
	error: "Select an account role",
});

export const updateLedgerAccountMappingSchema = z.object({
	role: ledgerAccountRoleSchema,
	accountId: z.coerce
		.number({ error: "Select a ledger account" })
		.int("Select a valid ledger account")
		.positive("Select a valid ledger account"),
	description: z
		.string()
		.trim()
		.max(5000, { message: "Description must be 5000 characters or less" })
		.nullable(),
});

export const ledgerAccountMappingFormSchema = z.object({
	role: ledgerAccountRoleSchema,
	accountId: z.string().trim().min(1, "Select a ledger account"),
	description: z
		.string()
		.trim()
		.max(5000, { message: "Description must be 5000 characters or less" }),
});

export type LedgerAccountMappingFormValues = z.infer<
	typeof ledgerAccountMappingFormSchema
>;
