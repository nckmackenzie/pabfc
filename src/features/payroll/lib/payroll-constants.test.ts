import { describe, expect, it } from "vitest";
import {
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	PAYROLL_ACCOUNT_ROLES,
	PAYROLL_DEFAULT_LEDGER_ACCOUNTS,
	PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES,
	PAYROLL_PARENT_LEDGER_ACCOUNTS,
	PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES,
} from "./payroll-constants";

describe("payroll account constants", () => {
	it("defines all payroll account roles with defaults", () => {
		expect(PAYROLL_ACCOUNT_ROLE_KEYS).toHaveLength(18);
		expect(Object.keys(PAYROLL_ACCOUNT_ROLES)).toHaveLength(18);
		expect(Object.keys(PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES)).toHaveLength(18);
	});

	it("derives expected account types from role keys", () => {
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.salaries_expense).toBe("expense");
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.bonus_expense).toBe("expense");
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.paye_payable).toBe("liability");
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.net_salaries_payable).toBe(
			"liability"
		);
	});

	it("provides seed accounts for every default payroll code", () => {
		const seededCodes = new Set(PAYROLL_DEFAULT_LEDGER_ACCOUNTS.map((account) => account.code));

		for (const code of Object.values(PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES)) {
			expect(seededCodes.has(code)).toBe(true);
		}
	});

	it("assigns every payroll posting account to a seeded reporting parent", () => {
		const parentCodes = new Set(PAYROLL_PARENT_LEDGER_ACCOUNTS.map((account) => account.code));

		for (const code of PAYROLL_DEFAULT_LEDGER_ACCOUNTS.map((account) => account.code)) {
			const parentCode = PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES[code];
			expect(parentCode).toBeDefined();
			expect(parentCodes.has(parentCode)).toBe(true);
		}
	});
});
