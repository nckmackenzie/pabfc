import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { employees, payrollDeductions, payrollPeriods, payrollSlips } from "@/drizzle/schema";
import {
	buildDeductionsReport,
	isValidDeductionsReportStatus,
	type VoluntaryDeductionType,
} from "@/features/reports/lib/payroll-deductions";
import { toNumber } from "@/lib/helpers";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getDeductionsReportForPeriod = createServerFn()
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
				status: true,
			},
			where: eq(payrollPeriods.id, data.payrollPeriodId),
		});

		if (!period) {
			throw new ApplicationError("Payroll period not found");
		}

		if (!isValidDeductionsReportStatus(period.status)) {
			throw new ApplicationError(
				`Deductions report can only be generated for paid or closed periods. This period is currently "${period.status}".`
			);
		}

		const [slipRows, voluntaryRows] = await Promise.all([
			db
				.select({
					employeeNo: employees.employeeNo,
					firstName: employees.firstName,
					lastName: employees.lastName,
					netPaye: payrollSlips.netPaye,
					nssfEmployee: payrollSlips.nssfEmployee,
					shifEmployee: payrollSlips.shifEmployee,
					ahlEmployee: payrollSlips.ahlEmployee,
					helbDeduction: payrollSlips.helbDeduction,
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
				.orderBy(asc(employees.lastName), asc(employees.firstName)),

			db
				.select({
					employeeNo: employees.employeeNo,
					firstName: employees.firstName,
					lastName: employees.lastName,
					deductionType: payrollDeductions.deductionType,
					description: payrollDeductions.description,
					amount: payrollDeductions.amount,
				})
				.from(payrollDeductions)
				.innerJoin(employees, eq(payrollDeductions.employeeId, employees.id))
				.where(
					and(
						eq(payrollDeductions.payrollPeriodId, data.payrollPeriodId),
						isNull(employees.deletedAt)
					)
				)
				.orderBy(asc(payrollDeductions.deductionType), asc(employees.lastName), asc(employees.firstName)),
		]);

		const n = (v: string | null) => (v === null ? 0 : toNumber(v));

		return buildDeductionsReport({
			period: {
				id: period.id,
				name: period.name,
				periodMonth: period.periodMonth,
				periodYear: period.periodYear,
				status: period.status,
			},
			slips: slipRows.map((row) => ({
				employeeNo: row.employeeNo,
				employeeName: `${row.firstName} ${row.lastName}`.trim(),
				netPaye: n(row.netPaye),
				nssfEmployee: n(row.nssfEmployee),
				shifEmployee: n(row.shifEmployee),
				ahlEmployee: n(row.ahlEmployee),
				helbDeduction: n(row.helbDeduction),
			})),
			voluntaryDeductions: voluntaryRows.map((row) => ({
				employeeNo: row.employeeNo,
				employeeName: `${row.firstName} ${row.lastName}`.trim(),
				deductionType: row.deductionType as VoluntaryDeductionType,
				description: row.description,
				amount: toNumber(row.amount),
			})),
		});
	});

export type DeductionsReportResponse = Awaited<ReturnType<typeof getDeductionsReportForPeriod>>;
