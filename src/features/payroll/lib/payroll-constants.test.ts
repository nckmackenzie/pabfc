import { describe, expect, it } from "vitest";
import {
	LOAN_DEFAULT_INTEREST_RATE,
	LOAN_INTEREST_CALCULATION_METHOD,
	LOAN_MAX_DEDUCTION_RATIO,
	LOAN_STATUS,
	OVERTIME_MAX_HOURS_PER_FORTNIGHT,
	OVERTIME_MAX_NIGHT_HOURS_PER_FORTNIGHT,
	OVERTIME_MULTIPLIER_PUBLIC_HOLIDAY,
	OVERTIME_MULTIPLIER_WEEKDAY,
	OVERTIME_MULTIPLIER_WEEKEND,
	OVERTIME_STATUS,
	PAYROLL_ACCOUNT_ROLE_KEYS,
	PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	PAYROLL_ACCOUNT_ROLES,
	PAYROLL_DEFAULT_LEDGER_ACCOUNTS,
	PAYROLL_DEFAULT_ACCOUNT_PARENT_CODES,
	PAYROLL_JOURNAL_SOURCES,
	PAYROLL_PARENT_LEDGER_ACCOUNTS,
	PAYROLL_REMITTANCE_ITEM_TYPES,
	PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES,
	SALARY_ADVANCE_MAX_ADVANCE_RATIO,
	SALARY_ADVANCE_MAX_RECOVERY_MONTHS,
	SALARY_ADVANCE_STATUS,
} from "./payroll-constants";

describe("payroll account constants", () => {
	it("defines all payroll account roles with defaults", () => {
		expect(PAYROLL_ACCOUNT_ROLE_KEYS).toHaveLength(20);
		expect(Object.keys(PAYROLL_ACCOUNT_ROLES)).toHaveLength(20);
		expect(Object.keys(PAYROLL_ROLE_DEFAULT_ACCOUNT_CODES)).toHaveLength(20);
	});

	it("derives expected account types from role keys", () => {
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.salaries_expense).toBe("expense");
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.bonus_expense).toBe("expense");
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.loans_receivable).toBe("asset");
		expect(PAYROLL_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES.salary_advance_receivable).toBe("asset");
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

	it("defines overtime constants for payroll computation and workflow filters", () => {
		expect(OVERTIME_MULTIPLIER_WEEKDAY).toBe(1.5);
		expect(OVERTIME_MULTIPLIER_WEEKEND).toBe(2);
		expect(OVERTIME_MULTIPLIER_PUBLIC_HOLIDAY).toBe(2);
		expect(OVERTIME_MAX_HOURS_PER_FORTNIGHT).toBe(116);
		expect(OVERTIME_MAX_NIGHT_HOURS_PER_FORTNIGHT).toBe(144);
		expect(OVERTIME_STATUS).toEqual({
			DRAFT: "draft",
			APPROVED: "approved",
			PAID: "paid",
		});
	});

	it("defines loan constants for payroll loan workflows", () => {
		expect(LOAN_MAX_DEDUCTION_RATIO).toBeCloseTo(2 / 3);
		expect(LOAN_DEFAULT_INTEREST_RATE).toBe(0);
		expect(LOAN_INTEREST_CALCULATION_METHOD).toBe("reducing_balance");
		expect(LOAN_STATUS).toEqual({
			PENDING: "pending",
			ACTIVE: "active",
			PAUSED: "paused",
			FULLY_PAID: "fully_paid",
			WRITTEN_OFF: "written_off",
			REJECTED: "rejected",
		});
	});

	it("defines salary advance constants for payroll advance workflows", () => {
		expect(SALARY_ADVANCE_MAX_RECOVERY_MONTHS).toBe(3);
		expect(SALARY_ADVANCE_MAX_ADVANCE_RATIO).toBe(0.5);
		expect(SALARY_ADVANCE_STATUS).toEqual({
			PENDING: "pending",
			APPROVED: "approved",
			DISBURSED: "disbursed",
			RECOVERING: "recovering",
			FULLY_RECOVERED: "fully_recovered",
			REJECTED: "rejected",
			CANCELLED: "cancelled",
		});
	});

	it("defines payroll journal sources and remittance item types", () => {
		expect(PAYROLL_JOURNAL_SOURCES).toEqual({
			PAYROLL_RECOGNITION: "payroll_recognition",
			PAYROLL_DISBURSEMENT: "payroll_disbursement",
			PAYROLL_REMITTANCE: "payroll_remittance",
		});
		expect(PAYROLL_REMITTANCE_ITEM_TYPES).toEqual([
			"paye",
			"nssf",
			"shif",
			"ahl",
			"nita",
			"helb",
		]);
	});
});
