import { describe, expect, it } from "vitest";
import { netPayable, sumWhtAmounts, whtAmountForLine } from "@/features/bills/lib/wht";
import { taxCalculator } from "@/lib/helpers";

describe("whtAmountForLine", () => {
	it("withholds the stated rate on the VAT-exclusive amount", () => {
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 5 }, 10_000)).toBe(500);
	});

	it("returns zero when WHT is not applicable, whatever the rate says", () => {
		expect(whtAmountForLine({ whtApplicable: false, whtRate: 5 }, 10_000)).toBe(0);
		expect(whtAmountForLine({}, 10_000)).toBe(0);
	});

	it("returns zero for a missing, zero or negative rate", () => {
		expect(whtAmountForLine({ whtApplicable: true }, 10_000)).toBe(0);
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 0 }, 10_000)).toBe(0);
		expect(whtAmountForLine({ whtApplicable: true, whtRate: -5 }, 10_000)).toBe(0);
	});

	it("returns zero for a non-positive base", () => {
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 5 }, 0)).toBe(0);
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 5 }, -100)).toBe(0);
	});

	it("accepts a rate supplied as a string, as form state does", () => {
		expect(whtAmountForLine({ whtApplicable: true, whtRate: "3" }, 1_000)).toBe(30);
	});

	it("rounds half up to two decimals", () => {
		// 3% of 1,000.50 = 30.015
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 3 }, 1_000.5)).toBe(30.02);
	});

	it("excludes VAT from the base on a VAT-inclusive line", () => {
		const { amountExlusiveTax } = taxCalculator(11_600, "inclusive");
		// 11,600 inclusive of 16% VAT is 10,000 net; 5% of that is 500.
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 5 }, amountExlusiveTax)).toBe(
			500,
		);
	});

	it("uses the line amount as the base on a VAT-exclusive line", () => {
		const { amountExlusiveTax } = taxCalculator(10_000, "exclusive");
		expect(whtAmountForLine({ whtApplicable: true, whtRate: 5 }, amountExlusiveTax)).toBe(
			500,
		);
	});
});

describe("sumWhtAmounts", () => {
	it("totals the line amounts", () => {
		expect(sumWhtAmounts([500, 30.02, 0])).toBe(530.02);
	});

	it("treats absent values as zero", () => {
		expect(sumWhtAmounts([null, undefined, "", 10])).toBe(10);
	});

	it("is zero for a bill with no lines", () => {
		expect(sumWhtAmounts([])).toBe(0);
	});
});

describe("netPayable", () => {
	it("is the gross total less the amount withheld", () => {
		expect(netPayable(11_600, 500)).toBe(11_100);
	});

	it("equals the total when nothing is withheld", () => {
		expect(netPayable(11_600, 0)).toBe(11_600);
	});

	it("keeps the credit split exactly balanced against the total", () => {
		const total = 11_600.33;
		const wht = 530.02;
		expect(netPayable(total, wht) + wht).toBe(total);
	});
});
