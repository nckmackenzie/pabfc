/**
 * The ledger accounts the application posts to by *purpose* rather than by name.
 *
 * Each role is bound to a real ledger account in `ledger_account_mappings`, which
 * is the source of truth and is edited from the Account Mappings page. This file
 * holds only the catalogue — what each role means and what type of account it
 * requires — because the code has to know the role `accounts_payable` exists in
 * order to ask for it. It must never know *which* account that is.
 *
 * Resolving by mapped id rather than by name is what makes renaming an account in
 * the chart of accounts safe. The previous behaviour matched on `lower(name)`, so
 * a rename silently created a second account and stranded the balance on the
 * original.
 *
 * This module is imported by the Drizzle schema to build the role enum, so it must
 * not import from the schema in return.
 */
export type LedgerAccountRoleAccountType = "asset" | "liability" | "equity";

type LedgerAccountRoleDefinition = {
	label: string;
	description: string;
	requiredAccountType: LedgerAccountRoleAccountType;
	/**
	 * Account the seeder binds this role to on first run, matched on `code` and
	 * then on `name`. Only a starting point — the mapping, once written, is
	 * authoritative and the seeder never overwrites it.
	 */
	defaultCode: string;
	defaultName: string;
};

export const LEDGER_ACCOUNT_ROLES = {
	accounts_payable: {
		label: "Accounts Payable",
		description:
			"Credited for the amount owed to a vendor when a bill posts, and debited when that vendor is paid. Net of any withholding tax.",
		requiredAccountType: "liability",
		defaultCode: "2001",
		defaultName: "Accounts Payable",
	},
	vat_input: {
		label: "VAT Input",
		description:
			"Debited for recoverable VAT charged on bills and expenses.",
		requiredAccountType: "asset",
		defaultCode: "1101",
		defaultName: "Vat Input",
	},
	wht_payable: {
		label: "WHT Payable",
		description:
			"Credited for withholding tax deducted from a vendor bill, and debited when that tax is remitted to KRA.",
		requiredAccountType: "liability",
		defaultCode: "2202",
		defaultName: "WHT Payable",
	},
	opening_balance_equity: {
		label: "Opening Balance Equity",
		description:
			"Balancing account used when opening balances are entered against a ledger account.",
		requiredAccountType: "equity",
		defaultCode: "3000",
		defaultName: "opening balance equity",
	},
} as const satisfies Record<string, LedgerAccountRoleDefinition>;

export type LedgerAccountRole = keyof typeof LEDGER_ACCOUNT_ROLES;

export const LEDGER_ACCOUNT_ROLE_KEYS = Object.keys(
	LEDGER_ACCOUNT_ROLES,
) as Array<LedgerAccountRole>;

export const LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES = Object.fromEntries(
	LEDGER_ACCOUNT_ROLE_KEYS.map((role) => [
		role,
		LEDGER_ACCOUNT_ROLES[role].requiredAccountType,
	]),
) as Record<LedgerAccountRole, LedgerAccountRoleAccountType>;
