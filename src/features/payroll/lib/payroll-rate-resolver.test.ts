import { describe, expect, it } from "vitest";
import { PAYE_BANDS, SHIF_MINIMUM_CONTRIBUTION } from "@/features/payroll/lib/payroll-constants";
import { resolveStatutoryRatesSync } from "@/features/payroll/lib/payroll-rate-resolver";

describe("payroll rate resolver", () => {
	it("returns constant-backed rates for synchronous previews", () => {
		const resolved = resolveStatutoryRatesSync(new Date("2026-06-17T00:00:00.000Z"));

		expect(resolved.payeBands).toEqual(PAYE_BANDS);
		expect(resolved.shifMinimum).toBe(SHIF_MINIMUM_CONTRIBUTION);
		expect(Object.values(resolved.resolvedFrom)).toSatisfy((values: string[]) =>
			values.every((value) => value === "constant")
		);
	});
});
