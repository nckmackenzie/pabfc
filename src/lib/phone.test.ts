import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, phoneMatchVariants } from "@/lib/phone";

describe("normalizeKenyanPhone", () => {
	it.each([
		["0712345678", "+254712345678"],
		["0112345678", "+254112345678"],
		["712345678", "+254712345678"],
		["112345678", "+254112345678"],
		["254712345678", "+254712345678"],
		["+254712345678", "+254712345678"],
		["254112345678", "+254112345678"],
		["+254112345678", "+254112345678"],
	])("normalises %s", (input, expected) => {
		expect(normalizeKenyanPhone(input)).toBe(expected);
	});

	it("ignores spaces, dashes and brackets", () => {
		expect(normalizeKenyanPhone(" 0712 345-678 ")).toBe("+254712345678");
		expect(normalizeKenyanPhone("+254 (712) 345 678")).toBe("+254712345678");
		expect(normalizeKenyanPhone("[0712]-345678")).toBe("+254712345678");
	});

	it.each([
		"",
		"   ",
		"abc",
		"0712 34567", // too short
		"07123456789", // too long
		"0212345678", // not a mobile range
		"212345678",
		"+0712345678", // plus without country code
		"+712345678",
		"+255712345678", // another country
		"25471234567",
		"0712-34x678",
		"++254712345678",
	])("rejects %j", (input) => {
		expect(normalizeKenyanPhone(input)).toBeNull();
	});
});

describe("phoneMatchVariants", () => {
	it("returns the canonical value plus the stored formats", () => {
		expect(phoneMatchVariants("0712345678")).toEqual([
			"+254712345678",
			"0712345678",
			"254712345678",
			"712345678",
		]);
	});

	it("returns the same set whichever format was typed", () => {
		const expected = [...phoneMatchVariants("0712345678")].sort();
		for (const input of ["+254712345678", "254712345678", "712345678", "0712 345 678"]) {
			expect([...phoneMatchVariants(input)].sort()).toEqual(expected);
		}
	});

	it("handles 01 numbers", () => {
		expect(phoneMatchVariants("0112345678")).toEqual([
			"+254112345678",
			"0112345678",
			"254112345678",
			"112345678",
		]);
	});

	it("is empty for invalid input", () => {
		expect(phoneMatchVariants("")).toEqual([]);
		expect(phoneMatchVariants("12345")).toEqual([]);
		expect(phoneMatchVariants("+255712345678")).toEqual([]);
	});
});
