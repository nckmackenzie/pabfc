import { describe, expect, it } from "vitest";
import {
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	PAYROLL_ACCOUNT_ROLES,
	PAYROLL_DEFAULT_LEDGER_ACCOUNTS,
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
});
