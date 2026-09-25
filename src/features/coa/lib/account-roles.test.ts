import { describe, expect, it } from "vitest";
import {
	LEDGER_ACCOUNT_ROLE_KEYS,
	LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES,
	LEDGER_ACCOUNT_ROLES,
} from "@/features/coa/lib/account-roles";

describe("LEDGER_ACCOUNT_ROLES", () => {
	/**
	 * Pins the catalogue. A role is baked into a pg enum, so adding or removing one
	 * needs a migration — this makes that a deliberate, reviewed change rather than
	 * something that drifts in.
	 */
	it("contains exactly the four posting roles", () => {
		expect(LEDGER_ACCOUNT_ROLE_KEYS).toEqual([
			"accounts_payable",
			"vat_input",
			"wht_payable",
			"opening_balance_equity",
		]);
	});

	it("gives every role a label, description and account type", () => {
		for (const role of LEDGER_ACCOUNT_ROLE_KEYS) {
			const definition = LEDGER_ACCOUNT_ROLES[role];
			expect(definition.label.trim()).not.toBe("");
			expect(definition.description.trim()).not.toBe("");
			expect(["asset", "liability", "equity"]).toContain(
				definition.requiredAccountType,
			);
		}
	});

	it("requires the account type each role actually posts to", () => {
		expect(LEDGER_ACCOUNT_ROLE_REQUIRED_ACCOUNT_TYPES).toEqual({
			accounts_payable: "liability",
			vat_input: "asset",
			wht_payable: "liability",
			opening_balance_equity: "equity",
		});
	});

	it("gives every role a seed default so the mappings page opens configured", () => {
		for (const role of LEDGER_ACCOUNT_ROLE_KEYS) {
			const { defaultCode, defaultName } = LEDGER_ACCOUNT_ROLES[role];
			expect(defaultCode).toMatch(/^\d+$/);
			expect(defaultName.trim()).not.toBe("");
		}
	});

	it("does not reuse a default code across roles", () => {
		const codes = LEDGER_ACCOUNT_ROLE_KEYS.map(
			(role) => LEDGER_ACCOUNT_ROLES[role].defaultCode,
		);
		expect(new Set(codes).size).toBe(codes.length);
	});

	it("puts each default code in the range for its account type", () => {
		// The chart of accounts numbers assets 1xxx, liabilities 2xxx, equity 3xxx.
		const expectedPrefix = { asset: "1", liability: "2", equity: "3" } as const;

		for (const role of LEDGER_ACCOUNT_ROLE_KEYS) {
			const { defaultCode, requiredAccountType } = LEDGER_ACCOUNT_ROLES[role];
			expect(defaultCode.startsWith(expectedPrefix[requiredAccountType])).toBe(
				true,
			);
		}
	});

	it("derives the role keys from the catalogue itself", () => {
		expect(LEDGER_ACCOUNT_ROLE_KEYS).toEqual(Object.keys(LEDGER_ACCOUNT_ROLES));
	});
});
