import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { employees, payrollPeriods, payrollSlips } from "@/drizzle/schema";
import {
	buildStatutorySchedulesReport,
	isValidStatutoryScheduleStatus,
} from "@/features/reports/lib/statutory-schedules";
import { toNumber } from "@/lib/helpers";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getStatutorySchedulesForPeriod = createServerFn()
	.middleware([authMiddleware])
	.validator(z.object({ payrollPeriodId: z.string().min(1) }))
	.handler(async ({ data }) => {
		await requirePermission("payroll-periods:view");

		const period = await db.query.payrollPeriods.findFirst({
			columns: {
				id: true,
				name: true,
				periodMonth: true,
				periodYear: true,
				payDate: true,
				status: true,
				totalNssfEmployee: true,
				totalNssfEmployer: true,
				totalShifEmployee: true,
				totalAhlEmployee: true,
				totalAhlEmployer: true,
				totalNita: true,
			},
			where: eq(payrollPeriods.id, data.payrollPeriodId),
		});

		if (!period) {
			throw new ApplicationError("Payroll period not found");
		}

		if (!isValidStatutoryScheduleStatus(period.status)) {
			throw new ApplicationError(
				`Statutory schedules can only be generated for paid or closed periods. This period is currently "${period.status}".`
			);
		}

		const rows = await db
			.select({
				employeeNo: employees.employeeNo,
				firstName: employees.firstName,
				lastName: employees.lastName,
				nssfNo: employees.nssfNo,
				shifNo: employees.shifNo,
				kraPin: employees.kraPin,
				nssfEmployee: payrollSlips.nssfEmployee,
				nssfEmployer: payrollSlips.nssfEmployer,
				shifEmployee: payrollSlips.shifEmployee,
				ahlEmployee: payrollSlips.ahlEmployee,
				ahlEmployer: payrollSlips.ahlEmployer,
				nitaLevy: payrollSlips.nitaLevy,
			})
			.from(payrollSlips)
			.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
			.where(
				and(
					eq(payrollSlips.payrollPeriodId, data.payrollPeriodId),
					ne(payrollSlips.status, "cancelled"),
					isNull(employees.deletedAt)
				)
			)
			.orderBy(asc(employees.lastName), asc(employees.firstName));

		const n = (v: string | null) => (v === null ? 0 : toNumber(v));

		const report = buildStatutorySchedulesReport({
			period: {
				id: period.id,
				name: period.name,
				periodMonth: period.periodMonth,
				periodYear: period.periodYear,
				payDate: period.payDate,
				status: period.status,
			},
			slips: rows.map((row) => ({
				employeeNo: row.employeeNo,
				employeeName: `${row.firstName} ${row.lastName}`.trim(),
				nssfNo: row.nssfNo ?? null,
				shifNo: row.shifNo ?? null,
				kraPin: row.kraPin ?? null,
				nssfEmployee: n(row.nssfEmployee),
				nssfEmployer: n(row.nssfEmployer),
				shifEmployee: n(row.shifEmployee),
				ahlEmployee: n(row.ahlEmployee),
				ahlEmployer: n(row.ahlEmployer),
				nitaLevy: n(row.nitaLevy),
			})),
		});

		const toN = (v: string | null) => (v === null ? null : toNumber(v));

		return {
			...report,
			storedTotals: {
				nssfEmployee: toN(period.totalNssfEmployee),
				nssfEmployer: toN(period.totalNssfEmployer),
				shifEmployee: toN(period.totalShifEmployee),
				ahlEmployee: toN(period.totalAhlEmployee),
				ahlEmployer: toN(period.totalAhlEmployer),
				nita: toN(period.totalNita),
			},
		};
	});

export type StatutorySchedulesResponse = Awaited<ReturnType<typeof getStatutorySchedulesForPeriod>>;
