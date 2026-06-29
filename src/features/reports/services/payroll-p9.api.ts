import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { employees, payrollPeriods, payrollSlips } from "@/drizzle/schema";
import { buildPayrollP9Report } from "@/features/reports/lib/payroll-p9";
import { toNumber } from "@/lib/helpers";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

const payrollP9RequestSchema = z.object({
	employeeId: z.string().min(1, "Select employee"),
	taxYear: z.coerce.number().int().min(2020).max(2100),
});

async function requirePayrollP9Access() {
	await requirePermission("reports:payroll-p9");
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:view");
}

export const getPayrollP9Options = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollP9Access();

		const rows = await db
			.select({
				employeeId: employees.id,
				employeeNo: employees.employeeNo,
				fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				taxYear: payrollPeriods.periodYear,
			})
			.from(payrollSlips)
			.innerJoin(employees, eq(payrollSlips.employeeId, employees.id))
			.innerJoin(payrollPeriods, eq(payrollSlips.payrollPeriodId, payrollPeriods.id))
			.where(and(eq(payrollPeriods.status, "closed"), isNull(employees.deletedAt)))
			.orderBy(asc(employees.lastName), asc(employees.firstName), desc(payrollPeriods.periodYear));

		const employeeMap = new Map<string, { value: string; label: string }>();
		const employeeTaxYearMap = new Map<string, Set<number>>();

		for (const row of rows) {
			if (!employeeMap.has(row.employeeId)) {
				employeeMap.set(row.employeeId, {
					value: row.employeeId,
					label: `${row.fullName} (${row.employeeNo})`,
				});
			}

			const years = employeeTaxYearMap.get(row.employeeId) ?? new Set<number>();
			years.add(row.taxYear);
			employeeTaxYearMap.set(row.employeeId, years);
		}

		return {
			employees: Array.from(employeeMap.values()),
			employeeTaxYears: Object.fromEntries(
				Array.from(employeeTaxYearMap.entries()).map(([employeeId, years]) => [
					employeeId,
					Array.from(years).sort((left, right) => right - left),
				])
			) as Record<string, number[]>,
		};
	});

export const getPayrollP9Report = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollP9RequestSchema)
	.handler(async ({ data }) => {
		await requirePayrollP9Access();

		const employee = await db.query.employees.findFirst({
			columns: {
				employeeNo: true,
				firstName: true,
				lastName: true,
				kraPin: true,
				hireDate: true,
				terminationDate: true,
			},
			where: and(eq(employees.id, data.employeeId), isNull(employees.deletedAt)),
		});

		if (!employee) {
			throw new ApplicationError("Employee not found");
		}

		const closedMonths = await db
			.select({
				slipId: payrollSlips.id,
				periodMonth: payrollPeriods.periodMonth,
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
			.from(payrollPeriods)
			.leftJoin(
				payrollSlips,
				and(
					eq(payrollSlips.payrollPeriodId, payrollPeriods.id),
					eq(payrollSlips.employeeId, data.employeeId)
				)
			)
			.where(and(eq(payrollPeriods.periodYear, data.taxYear), eq(payrollPeriods.status, "closed")))
			.orderBy(asc(payrollPeriods.periodMonth));

		if (!closedMonths.some((month) => month.slipId !== null)) {
			throw new ApplicationError(
				"No closed payroll slips found for the selected employee and tax year"
			);
		}

		return buildPayrollP9Report({
			employee,
			taxYear: data.taxYear,
			closedMonths: closedMonths.map((month) => ({
				periodMonth: month.periodMonth,
				basicSalary: month.basicSalary === null ? null : toNumber(month.basicSalary),
				grossPay: month.grossPay === null ? null : toNumber(month.grossPay),
				nssfEmployee: month.nssfEmployee === null ? null : toNumber(month.nssfEmployee),
				pensionEmployeeDeduction:
					month.pensionEmployeeDeduction === null
						? null
						: toNumber(month.pensionEmployeeDeduction),
				ahlEmployee: month.ahlEmployee === null ? null : toNumber(month.ahlEmployee),
				shifEmployee: month.shifEmployee === null ? null : toNumber(month.shifEmployee),
				postRetirementAllowableDeduction:
					month.postRetirementAllowableDeduction === null
						? null
						: toNumber(month.postRetirementAllowableDeduction),
				mortgageAllowableDeduction:
					month.mortgageAllowableDeduction === null
						? null
						: toNumber(month.mortgageAllowableDeduction),
				grossTax: month.grossTax === null ? null : toNumber(month.grossTax),
				personalRelief: month.personalRelief === null ? null : toNumber(month.personalRelief),
				insuranceRelief: month.insuranceRelief === null ? null : toNumber(month.insuranceRelief),
				netPaye: month.netPaye === null ? null : toNumber(month.netPaye),
			})),
		});
	});

export type PayrollP9OptionsResponse = Awaited<ReturnType<typeof getPayrollP9Options>>;
export type PayrollP9ReportResponse = Awaited<ReturnType<typeof getPayrollP9Report>>;
