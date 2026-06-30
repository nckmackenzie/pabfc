import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { employees, payrollPeriods, payrollSlips } from "@/drizzle/schema";
import { buildPayrollP10Report, isValidP10Status } from "@/features/reports/lib/payroll-p10";
import { toNumber } from "@/lib/helpers";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getPayrollP10Report = createServerFn()
	.middleware([authMiddleware])
	.validator(z.object({ payrollPeriodId: z.string().min(1) }))
	.handler(async ({ data }) => {
		await requirePermission("payroll-periods:view");
		await requirePermission("employees:payroll-information");

		const period = await db.query.payrollPeriods.findFirst({
			columns: {
				id: true,
				name: true,
				periodMonth: true,
				periodYear: true,
				payDate: true,
				status: true,
				totalPaye: true,
			},
			where: eq(payrollPeriods.id, data.payrollPeriodId),
		});

		if (!period) {
			throw new ApplicationError("Payroll period not found");
		}

		if (!isValidP10Status(period.status)) {
			throw new ApplicationError(
				`P10 can only be generated for paid or closed periods. This period is currently "${period.status}" — it must be paid first.`
			);
		}

		const rows = await db
			.select({
				employeeNo: employees.employeeNo,
				firstName: employees.firstName,
				lastName: employees.lastName,
				kraPin: employees.kraPin,
				basicSalary: payrollSlips.basicSalary,
				grossPay: payrollSlips.grossPay,
				nssfEmployee: payrollSlips.nssfEmployee,
				pensionEmployeeDeduction: payrollSlips.pensionEmployeeDeduction,
				ahlEmployee: payrollSlips.ahlEmployee,
				shifEmployee: payrollSlips.shifEmployee,
				postRetirementAllowableDeduction: payrollSlips.postRetirementAllowableDeduction,
				mortgageAllowableDeduction: payrollSlips.mortgageAllowableDeduction,
				grossTax: payrollSlips.grossTax,
				personalRelief: payrollSlips.personalRelief,
				insuranceRelief: payrollSlips.insuranceRelief,
				netPaye: payrollSlips.netPaye,
			})
			.from(payrollSlips)
			.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
			.where(
				and(
					eq(payrollSlips.payrollPeriodId, data.payrollPeriodId),
					ne(payrollSlips.status, "cancelled")
				)
			)
			.orderBy(asc(employees.lastName), asc(employees.firstName));

		const n = (v: string | null) => (v === null ? null : toNumber(v));

		return {
			...buildPayrollP10Report({
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
					kraPin: row.kraPin,
					basicSalary: n(row.basicSalary),
					grossPay: n(row.grossPay),
					nssfEmployee: n(row.nssfEmployee),
					pensionEmployeeDeduction: n(row.pensionEmployeeDeduction),
					ahlEmployee: n(row.ahlEmployee),
					shifEmployee: n(row.shifEmployee),
					postRetirementAllowableDeduction: n(row.postRetirementAllowableDeduction),
					mortgageAllowableDeduction: n(row.mortgageAllowableDeduction),
					grossTax: n(row.grossTax),
					personalRelief: n(row.personalRelief),
					insuranceRelief: n(row.insuranceRelief),
					netPaye: n(row.netPaye),
				})),
			}),
			periodTotalPaye: period.totalPaye === null ? null : toNumber(period.totalPaye),
		};
	});

export type PayrollP10ReportResponse = Awaited<ReturnType<typeof getPayrollP10Report>>;
