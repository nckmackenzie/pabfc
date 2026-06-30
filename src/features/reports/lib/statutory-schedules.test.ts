import { describe, expect, it } from "vitest";
import {
	buildStatutorySchedulesReport,
	isValidStatutoryScheduleStatus,
	type StatutoryScheduleSlip,
} from "./statutory-schedules";

const period = {
	id: "period-1",
	name: "June 2026",
	periodMonth: 6,
	periodYear: 2026,
	payDate: "2026-06-30",
	status: "paid",
} as const;

function makeSlip(employeeNo: string, overrides?: Partial<StatutoryScheduleSlip>): StatutoryScheduleSlip {
	return {
		employeeNo,
		employeeName: `Employee ${employeeNo}`,
		nssfNo: `NSSF-${employeeNo}`,
		shifNo: `SHIF-${employeeNo}`,
		kraPin: `A${employeeNo}Z`,
		nssfEmployee: overrides?.nssfEmployee ?? 4_320,
		nssfEmployer: overrides?.nssfEmployer ?? 4_320,
		shifEmployee: overrides?.shifEmployee ?? 1_650,
		ahlEmployee: overrides?.ahlEmployee ?? 900,
		ahlEmployer: overrides?.ahlEmployer ?? 900,
		nitaLevy: overrides?.nitaLevy ?? 50,
		...overrides,
	};
}

// Simulated stored period totals (what payroll_periods would store)
function makePeriodTotals(slips: StatutoryScheduleSlip[]) {
	return {
		totalNssfEmployee: slips.reduce((a, s) => a + s.nssfEmployee, 0),
		totalNssfEmployer: slips.reduce((a, s) => a + s.nssfEmployer, 0),
		totalShifEmployee: slips.reduce((a, s) => a + s.shifEmployee, 0),
		totalAhlEmployee: slips.reduce((a, s) => a + s.ahlEmployee, 0),
		totalAhlEmployer: slips.reduce((a, s) => a + s.ahlEmployer, 0),
		totalNita: slips.reduce((a, s) => a + s.nitaLevy, 0),
	};
}

describe("buildStatutorySchedulesReport", () => {
	describe("NSSF section", () => {
		it("computes per-employee totals as employee + employer", () => {
			const slips = [makeSlip("EMP-001", { nssfEmployee: 4_320, nssfEmployer: 4_320 })];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.nssf.rows[0]!.total).toBe(8_640);
		});

		it("sums NSSF totals correctly across multiple employees", () => {
			const slips = [
				makeSlip("EMP-001", { nssfEmployee: 4_320, nssfEmployer: 4_320 }),
				makeSlip("EMP-002", { nssfEmployee: 4_320, nssfEmployer: 4_320 }),
			];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.nssf.totals.nssfEmployee).toBe(8_640);
			expect(report.nssf.totals.nssfEmployer).toBe(8_640);
			expect(report.nssf.totals.total).toBe(17_280);
		});

		it("computed NSSF totals reconcile with stored period totals", () => {
			const slips = [
				makeSlip("EMP-001", { nssfEmployee: 4_320, nssfEmployer: 4_320 }),
				makeSlip("EMP-002", { nssfEmployee: 2_160, nssfEmployer: 2_160 }),
				makeSlip("EMP-003", { nssfEmployee: 4_320, nssfEmployer: 4_320 }),
			];
			const stored = makePeriodTotals(slips);
			const report = buildStatutorySchedulesReport({ period, slips });

			expect(report.nssf.totals.nssfEmployee).toBe(stored.totalNssfEmployee);
			expect(report.nssf.totals.nssfEmployer).toBe(stored.totalNssfEmployer);
		});
	});

	describe("SHIF section", () => {
		it("sums SHIF employee contributions correctly", () => {
			const slips = [
				makeSlip("EMP-001", { shifEmployee: 1_650 }),
				makeSlip("EMP-002", { shifEmployee: 2_750 }),
			];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.shif.totals.shifEmployee).toBe(4_400);
		});

		it("computed SHIF total reconciles with stored period total", () => {
			const slips = [
				makeSlip("EMP-001", { shifEmployee: 1_650 }),
				makeSlip("EMP-002", { shifEmployee: 2_750 }),
				makeSlip("EMP-003", { shifEmployee: 962.5 }),
			];
			const stored = makePeriodTotals(slips);
			const report = buildStatutorySchedulesReport({ period, slips });

			expect(report.shif.totals.shifEmployee).toBe(stored.totalShifEmployee);
		});

		it("includes SHIF number on each row", () => {
			const slips = [makeSlip("EMP-001", { shifNo: "SH-12345" })];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.shif.rows[0]!.shifNo).toBe("SH-12345");
		});
	});

	describe("AHL section", () => {
		it("computes per-employee AHL totals as employee + employer", () => {
			const slips = [makeSlip("EMP-001", { ahlEmployee: 900, ahlEmployer: 900 })];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.ahl.rows[0]!.total).toBe(1_800);
		});

		it("computed AHL totals reconcile with stored period totals", () => {
			const slips = [
				makeSlip("EMP-001", { ahlEmployee: 900, ahlEmployer: 900 }),
				makeSlip("EMP-002", { ahlEmployee: 1_500, ahlEmployer: 1_500 }),
			];
			const stored = makePeriodTotals(slips);
			const report = buildStatutorySchedulesReport({ period, slips });

			expect(report.ahl.totals.ahlEmployee).toBe(stored.totalAhlEmployee);
			expect(report.ahl.totals.ahlEmployer).toBe(stored.totalAhlEmployer);
		});

		it("includes KRA PIN on each AHL row", () => {
			const slips = [makeSlip("EMP-001", { kraPin: "A012345678Z" })];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.ahl.rows[0]!.kraPin).toBe("A012345678Z");
		});
	});

	describe("NITA section", () => {
		it("returns employee count equal to number of slips", () => {
			const slips = [makeSlip("EMP-001"), makeSlip("EMP-002"), makeSlip("EMP-003")];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.nita.employeeCount).toBe(3);
		});

		it("sums NITA levies from slips", () => {
			const slips = [
				makeSlip("EMP-001", { nitaLevy: 50 }),
				makeSlip("EMP-002", { nitaLevy: 50 }),
			];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.nita.totalLevy).toBe(100);
		});

		it("computed NITA total reconciles with stored period total", () => {
			const slips = [
				makeSlip("EMP-001", { nitaLevy: 50 }),
				makeSlip("EMP-002", { nitaLevy: 50 }),
				makeSlip("EMP-003", { nitaLevy: 50 }),
			];
			const stored = makePeriodTotals(slips);
			const report = buildStatutorySchedulesReport({ period, slips });

			expect(report.nita.totalLevy).toBe(stored.totalNita);
		});
	});

	describe("status validation", () => {
		it("accepts paid status", () => expect(isValidStatutoryScheduleStatus("paid")).toBe(true));
		it("accepts closed status", () => expect(isValidStatutoryScheduleStatus("closed")).toBe(true));
		it("rejects approved status", () => expect(isValidStatutoryScheduleStatus("approved")).toBe(false));
		it("rejects draft status", () => expect(isValidStatutoryScheduleStatus("draft")).toBe(false));
		it("rejects processing status", () => expect(isValidStatutoryScheduleStatus("processing")).toBe(false));
		it("rejects cancelled status", () => expect(isValidStatutoryScheduleStatus("cancelled")).toBe(false));
	});

	describe("row structure", () => {
		it("returns one row per employee per section", () => {
			const slips = [makeSlip("EMP-001"), makeSlip("EMP-002")];
			const report = buildStatutorySchedulesReport({ period, slips });
			expect(report.nssf.rows).toHaveLength(2);
			expect(report.shif.rows).toHaveLength(2);
			expect(report.ahl.rows).toHaveLength(2);
		});

		it("includes period in the report", () => {
			const report = buildStatutorySchedulesReport({ period, slips: [] });
			expect(report.period.periodMonth).toBe(6);
			expect(report.period.periodYear).toBe(2026);
		});
	});
});
