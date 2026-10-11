import { describe, expect, it } from "vitest";
import { nairobiToday, toNairobiDateString } from "./nairobi-time";

describe("toNairobiDateString", () => {
	it("keeps the same Nairobi day just before the UTC+3 boundary", () => {
		expect(toNairobiDateString(new Date("2026-10-10T20:59:59Z"))).toBe("2026-10-10");
	});

	it("rolls over to the next Nairobi day exactly at the UTC+3 boundary", () => {
		expect(toNairobiDateString(new Date("2026-10-10T21:00:00Z"))).toBe("2026-10-11");
	});

	it("handles a year boundary correctly", () => {
		expect(toNairobiDateString(new Date("2026-12-31T20:59:59Z"))).toBe("2026-12-31");
		expect(toNairobiDateString(new Date("2026-12-31T21:00:00Z"))).toBe("2027-01-01");
	});
});

describe("nairobiToday", () => {
	it("computes today's Nairobi date from a given instant", () => {
		expect(nairobiToday(new Date("2026-06-15T12:00:00Z"))).toBe("2026-06-15");
	});
});
