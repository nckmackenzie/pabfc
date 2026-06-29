import { describe, expect, it } from "vitest";
import {
	getNextChildAccountCode,
	getNextRootAccountCode,
} from "./account-code-generator";

describe("account code generation", () => {
	it("assigns the next available root code inside a type block", () => {
		expect(
			getNextRootAccountCode({
				type: "asset",
				existingCodes: ["1000", "1090", "1100", "1200", "1001", "1101"],
				allAssignedCodes: ["1000", "1090", "1100", "1200", "1001", "1101"],
			}),
		).toBe("1300");
	});

	it("skips used hundred slots for top-level expense accounts", () => {
		expect(
			getNextRootAccountCode({
				type: "expense",
				existingCodes: ["5000", "5090", "5100", "5101", "5114"],
				allAssignedCodes: ["5000", "5090", "5100", "5101", "5114"],
			}),
		).toBe("5200");
	});

	it("skips globally assigned codes for new parent accounts and keeps the hundred-step order", () => {
		expect(
			getNextRootAccountCode({
				type: "liability",
				existingCodes: ["2000", "2090", "2200"],
				allAssignedCodes: ["2000", "2001", "2090", "2100", "2101", "2200", "2201"],
			}),
		).toBe("2300");
	});

	it("continues a child sequence from sibling codes", () => {
		expect(
			getNextChildAccountCode({
				parentCode: "5090",
				siblingCodes: ["5100", "5101", "5102", "5114"],
				allAssignedCodes: ["5090", "5100", "5101", "5102", "5114"],
			}),
		).toBe("5115");
	});

	it("starts the first child at parent code plus one when there are no siblings", () => {
		expect(
			getNextChildAccountCode({
				parentCode: "1100",
				siblingCodes: [],
				allAssignedCodes: ["1100"],
			}),
		).toBe("1101");
	});

	it("skips globally assigned codes for child accounts too", () => {
		expect(
			getNextChildAccountCode({
				parentCode: "2200",
				siblingCodes: ["2201"],
				allAssignedCodes: ["2200", "2201", "2202"],
			}),
		).toBe("2203");
	});
});
