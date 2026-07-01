import { describe, expect, it } from "vitest";
import { isBalanceSheetBalanced, isTrialBalanced } from "./report-balance-checks";

describe("isTrialBalanced", () => {
	it("is true when total debit balances equal total credit balances", () => {
		expect(
			isTrialBalanced([
				{ debit_balance: "1000", credit_balance: "0" },
				{ debit_balance: "0", credit_balance: "400" },
				{ debit_balance: "0", credit_balance: "600" },
			])
		).toBe(true);
	});

	it("is false when debits and credits do not match", () => {
		expect(
			isTrialBalanced([
				{ debit_balance: "1000", credit_balance: "0" },
				{ debit_balance: "0", credit_balance: "900" },
			])
		).toBe(false);
	});

	it("tolerates sub-cent floating point noise", () => {
		expect(
			isTrialBalanced([
				{ debit_balance: "0.10", credit_balance: "0" },
				{ debit_balance: "0.20", credit_balance: "0" },
				{ debit_balance: "0", credit_balance: "0.30" },
			])
		).toBe(true);
	});

	it("does not collapse large decimal imbalances through JS number precision", () => {
		expect(
			isTrialBalanced([
				{ debit_balance: "9007199254740992.01", credit_balance: "0" },
				{ debit_balance: "0", credit_balance: "9007199254740992.02" },
			])
		).toBe(false);
	});
});

describe("isBalanceSheetBalanced", () => {
	it("is true when assets equal liabilities plus equity", () => {
		expect(
			isBalanceSheetBalanced([
				{ type: "asset", total: "1000" },
				{ type: "liability", total: "400" },
				{ type: "equity", total: "600" },
			])
		).toBe(true);
	});

	it("is false when the two sides differ", () => {
		expect(
			isBalanceSheetBalanced([
				{ type: "asset", total: "1000" },
				{ type: "liability", total: "400" },
				{ type: "equity", total: "500" },
			])
		).toBe(false);
	});

	it("does not collapse large decimal balance-sheet variances through JS number precision", () => {
		expect(
			isBalanceSheetBalanced([
				{ type: "asset", total: "9007199254740992.01" },
				{ type: "liability", total: "9007199254740992.02" },
				{ type: "equity", total: "0" },
			])
		).toBe(false);
	});
});

/**
 * Regression for the top-level-only filter rule.
 *
 * Real scenario: `1000 Cash And Cash Equivalents` (parent_id IS NULL) has a
 * nested non-posting child `1001 Cash At Bank`. `1000`'s rolled balance already
 * includes `1001`'s subtree. Rendering `1001` as its own line item therefore
 * double-counts it and throws the statement out of balance. The reports must
 * only render `parent_id IS NULL` accounts.
 */
describe("top-level-only filter rule (nested-parent double-count)", () => {
	// Rolled balances for the top-level (parent_id IS NULL) accounts only.
	const topLevelBalanceSheet = [
		{ type: "asset" as const, total: "-80371.27" }, // 1000 (includes 1001 subtree)
		{ type: "asset" as const, total: "13750.00" }, // 1090
		{ type: "asset" as const, total: "4816.00" }, // 1100
		{ type: "liability" as const, total: "11600.00" }, // 2000
		{ type: "liability" as const, total: "10138.25" }, // 2090
		{ type: "liability" as const, total: "-5000.00" }, // 2200
		{ type: "equity" as const, total: "-78543.52" }, // current year earnings
	];
	// The buggy extra line: nested child 1001 rendered separately.
	const nestedChildRow = { type: "asset" as const, total: "-89381.27" }; // 1001

	it("balance sheet balances when only top-level accounts are shown", () => {
		expect(isBalanceSheetBalanced(topLevelBalanceSheet)).toBe(true);
	});

	it("balance sheet is thrown out of balance if a nested child is shown too", () => {
		expect(isBalanceSheetBalanced([...topLevelBalanceSheet, nestedChildRow])).toBe(false);
	});

	const topLevelTrialBalance = [
		{ debit_balance: "0", credit_balance: "80371.27" }, // 1000
		{ debit_balance: "13750.00", credit_balance: "0" }, // 1090
		{ debit_balance: "4816.00", credit_balance: "0" }, // 1100
		{ debit_balance: "0", credit_balance: "11600.00" }, // 2000
		{ debit_balance: "0", credit_balance: "10138.25" }, // 2090
		{ debit_balance: "5000.00", credit_balance: "0" }, // 2200
		{ debit_balance: "0", credit_balance: "13510.00" }, // 4000
		{ debit_balance: "31100.00", credit_balance: "0" }, // 5000
		{ debit_balance: "60953.52", credit_balance: "0" }, // 5090
	];
	const nestedChildTbRow = { debit_balance: "0", credit_balance: "89381.27" }; // 1001

	it("trial balance DR = CR when only top-level accounts are shown", () => {
		expect(isTrialBalanced(topLevelTrialBalance)).toBe(true);
	});

	it("trial balance breaks DR = CR if a nested child is shown too", () => {
		expect(isTrialBalanced([...topLevelTrialBalance, nestedChildTbRow])).toBe(false);
	});
});
