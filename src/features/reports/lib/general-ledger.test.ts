import { describe, expect, it } from "vitest";
import {
	buildGeneralLedger,
	filterGeneralLedgerRows,
	type GeneralLedgerLine,
	getOpeningBalanceScope,
} from "./general-ledger";

function line(overrides: Partial<GeneralLedgerLine> & { id: number }): GeneralLedgerLine {
	return {
		id: overrides.id,
		date: overrides.date ?? "2026-01-01",
		memo: overrides.memo ?? null,
		description: overrides.description ?? null,
		source: overrides.source ?? null,
		reference: overrides.reference ?? null,
		dc: overrides.dc ?? "debit",
		amount: overrides.amount ?? "0",
	};
}

describe("getOpeningBalanceScope", () => {
	it("carries full history for balance sheet accounts", () => {
		expect(getOpeningBalanceScope("asset")).toBe("full-history");
		expect(getOpeningBalanceScope("liability")).toBe("full-history");
		expect(getOpeningBalanceScope("equity")).toBe("full-history");
	});

	it("resets income statement accounts at the fiscal year start", () => {
		expect(getOpeningBalanceScope("revenue")).toBe("fiscal-year");
		expect(getOpeningBalanceScope("expense")).toBe("fiscal-year");
	});
});

describe("buildGeneralLedger", () => {
	it("walks a debit-normal account from its opening balance", () => {
		const result = buildGeneralLedger({
			normalBalance: "debit",
			openingDebits: "1000",
			openingCredits: "250",
			lines: [
				line({ id: 1, dc: "debit", amount: "500" }),
				line({ id: 2, dc: "credit", amount: "200.50" }),
			],
		});

		expect(result.openingBalance).toBe(750);
		expect(result.rows.map((row) => [row.debit, row.credit, row.runningBalance])).toEqual([
			[500, 0, 1250],
			[0, 200.5, 1049.5],
		]);
		expect(result.totalDebits).toBe(500);
		expect(result.totalCredits).toBe(200.5);
		expect(result.closingBalance).toBe(1049.5);
	});

	it("walks a credit-normal account with credits increasing the balance", () => {
		const result = buildGeneralLedger({
			normalBalance: "credit",
			openingDebits: "0",
			openingCredits: "300",
			lines: [
				line({ id: 1, dc: "credit", amount: "100" }),
				line({ id: 2, dc: "debit", amount: "450" }),
			],
		});

		expect(result.openingBalance).toBe(300);
		expect(result.rows.map((row) => row.runningBalance)).toEqual([400, -50]);
		expect(result.closingBalance).toBe(-50);
	});

	it("avoids floating point drift across many decimal lines", () => {
		const result = buildGeneralLedger({
			normalBalance: "debit",
			openingDebits: "0",
			openingCredits: "0",
			lines: Array.from({ length: 10 }, (_, i) => line({ id: i, dc: "debit", amount: "0.10" })),
		});

		expect(result.closingBalance).toBe(1);
		expect(result.totalDebits).toBe(1);
	});

	it("returns the opening balance as closing balance when there are no lines", () => {
		const result = buildGeneralLedger({
			normalBalance: "debit",
			openingDebits: "80",
			openingCredits: "30",
			lines: [],
		});

		expect(result.rows).toEqual([]);
		expect(result.closingBalance).toBe(50);
	});

	it("resets the running balance at each fiscal year start inside the period", () => {
		const result = buildGeneralLedger({
			normalBalance: "debit",
			openingDebits: "400",
			openingCredits: "0",
			yearStartDates: ["2026-01-01"],
			lines: [
				line({ id: 1, date: "2025-12-15", dc: "debit", amount: "100" }),
				line({ id: 2, date: "2026-01-01", dc: "debit", amount: "30" }),
				line({ id: 3, date: "2026-02-10", dc: "credit", amount: "10" }),
			],
		});

		expect(result.rows.map((row) => [row.kind, row.date, row.runningBalance])).toEqual([
			["transaction", "2025-12-15", 500],
			["year-reset", "2026-01-01", 0],
			["transaction", "2026-01-01", 30],
			["transaction", "2026-02-10", 20],
		]);
		expect(result.openingBalance).toBe(400);
		expect(result.totalDebits).toBe(130);
		expect(result.totalCredits).toBe(10);
		expect(result.closingBalance).toBe(20);
	});

	it("emits trailing year resets with no later lines and closes at zero", () => {
		const result = buildGeneralLedger({
			normalBalance: "credit",
			openingDebits: "0",
			openingCredits: "0",
			yearStartDates: ["2027-01-01", "2026-01-01"],
			lines: [line({ id: 1, date: "2025-06-01", dc: "credit", amount: "75" })],
		});

		expect(result.rows.map((row) => [row.kind, row.date])).toEqual([
			["transaction", "2025-06-01"],
			["year-reset", "2026-01-01"],
			["year-reset", "2027-01-01"],
		]);
		expect(result.closingBalance).toBe(0);
	});
});

describe("filterGeneralLedgerRows", () => {
	const { rows } = buildGeneralLedger({
		normalBalance: "debit",
		openingDebits: "0",
		openingCredits: "0",
		lines: [
			line({ id: 1, dc: "debit", amount: "100", memo: "Office Rent" }),
			line({ id: 2, dc: "debit", amount: "50", reference: "INV-204" }),
			line({ id: 3, dc: "credit", amount: "20", source: "expenses", description: "Water bill" }),
		],
	});

	it("returns all rows for an empty search", () => {
		expect(filterGeneralLedgerRows(rows, undefined)).toHaveLength(3);
		expect(filterGeneralLedgerRows(rows, "   ")).toHaveLength(3);
	});

	it("matches memo, reference, source and description case-insensitively", () => {
		expect(filterGeneralLedgerRows(rows, "rent").map((row) => row.id)).toEqual([1]);
		expect(filterGeneralLedgerRows(rows, "inv-2").map((row) => row.id)).toEqual([2]);
		expect(filterGeneralLedgerRows(rows, "EXPENSES").map((row) => row.id)).toEqual([3]);
		expect(filterGeneralLedgerRows(rows, "water").map((row) => row.id)).toEqual([3]);
	});

	it("keeps the running balance computed over the unfiltered rows", () => {
		const [row] = filterGeneralLedgerRows(rows, "water");
		expect(row.runningBalance).toBe(130);
	});

	it("keeps year reset rows when filtering", () => {
		const { rows: resetRows } = buildGeneralLedger({
			normalBalance: "debit",
			openingDebits: "0",
			openingCredits: "0",
			yearStartDates: ["2026-01-01"],
			lines: [
				line({ id: 1, date: "2025-12-01", dc: "debit", amount: "100", memo: "Office Rent" }),
				line({ id: 2, date: "2026-01-05", dc: "debit", amount: "40", memo: "Water bill" }),
			],
		});

		expect(filterGeneralLedgerRows(resetRows, "water").map((row) => row.kind)).toEqual([
			"year-reset",
			"transaction",
		]);
	});
});
