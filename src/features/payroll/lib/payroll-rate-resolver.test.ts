import { describe, expect, it } from "vitest";
import { statutoryRates } from "@/drizzle/schema";
import { PAYE_BANDS, SHIF_MINIMUM_CONTRIBUTION } from "@/features/payroll/lib/payroll-constants";
import {
	resolveStatutoryRates,
	resolveStatutoryRatesSync,
	type PayrollDbClient,
} from "@/features/payroll/lib/payroll-rate-resolver";

type StatutoryRateRecord = typeof statutoryRates.$inferSelect;

function createRateRow(
	overrides: Partial<StatutoryRateRecord> = {}
): StatutoryRateRecord {
	return {
		id: "rate_1",
		category: "paye_band",
		label: "Band 1",
		effectiveFrom: "2025-07-01",
		effectiveTo: null,
		lowerBound: "0.00",
		upperBound: "24000.00",
		rate: "0.100000",
		fixedAmount: null,
		notes: null,
		createdBy: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("payroll rate resolver", () => {
	it("returns constant-backed rates for synchronous previews", () => {
		const resolved = resolveStatutoryRatesSync(new Date("2026-06-17T00:00:00.000Z"));

		expect(resolved.payeBands).toEqual(PAYE_BANDS);
		expect(resolved.shifMinimum).toBe(SHIF_MINIMUM_CONTRIBUTION);
		expect(Object.values(resolved.resolvedFrom)).toSatisfy((values: string[]) =>
			values.every((value) => value === "constant")
		);
	});

	it("falls back to constants when the latest PAYE band set has gaps", async () => {
		const mockDbClient = {
			query: {
				statutoryRates: {
					findMany: async () => [
						createRateRow(),
						createRateRow({
							id: "rate_2",
							label: "Band 2",
							lowerBound: "25000.00",
							upperBound: "32333.00",
							rate: "0.250000",
						}),
					],
				},
			},
		} as PayrollDbClient;

		const resolved = await resolveStatutoryRates(
			new Date("2026-06-17T00:00:00.000Z"),
			mockDbClient
		);

		expect(resolved.payeBands).toEqual(PAYE_BANDS);
		expect(resolved.resolvedFrom.payeBands).toBe("constant");
	});
});
