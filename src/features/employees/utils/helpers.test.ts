import { describe, expect, it } from "vitest";
import {
	createEmployeeDefaultValues,
	extractEmployeeNumberSequence,
	formatEmployeeNumber,
	getNextEmployeeNumber,
	normalizeEmployeeFormValues,
} from "./helpers";

describe("employee helpers", () => {
	it("formats employee numbers with a minimum of four digits", () => {
		expect(formatEmployeeNumber(7)).toBe("0007");
		expect(formatEmployeeNumber(10023)).toBe("10023");
	});

	it("extracts numeric sequences from employee numbers", () => {
		expect(extractEmployeeNumberSequence("EMP-0012")).toBe(12);
		expect(extractEmployeeNumberSequence("ABC")).toBe(0);
	});

	it("computes the next employee number from existing records", () => {
		expect(getNextEmployeeNumber(["0001", "EMP-0012", null])).toBe("0013");
	});

	it("normalizes form values before persistence", () => {
		const normalized = normalizeEmployeeFormValues({
			...createEmployeeDefaultValues("0001"),
			firstName: "  John ",
			lastName: " Doe  ",
			phone: " 0712345678 ",
			email: "",
			bankName: " ",
		});

		expect(normalized.firstName).toBe("John");
		expect(normalized.lastName).toBe("Doe");
		expect(normalized.phone).toBe("0712345678");
		expect(normalized.email).toBeNull();
		expect(normalized.bankName).toBeNull();
	});
});
