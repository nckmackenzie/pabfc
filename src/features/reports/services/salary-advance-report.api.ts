import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { employees, salaryAdvances } from "@/drizzle/schema";
import {
	buildSalaryAdvanceStatementCurrentPosition,
	buildSalaryAdvanceStatementRows,
	buildSalaryAdvanceSummaryReport,
	resolveSalaryAdvanceStatuses,
} from "@/features/reports/lib/salary-advance-report";
import { salaryAdvanceStatusSchema } from "@/features/payroll/services/salary-advance.schemas";
import {
	getAdvanceByIdFn,
	getAdvanceRecoveryStatementFn,
	getSalaryAdvanceFormOptionsFn,
} from "@/features/payroll/services/salary-advances.api";
import { toNumber } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

const salaryAdvanceSummaryRequestSchema = z.object({
	employeeId: z.string().trim().optional(),
	status: z.union([salaryAdvanceStatusSchema, z.literal("active")]).optional(),
});

const salaryAdvanceStatementRequestSchema = z.object({
	advanceId: z.string().trim().min(1, "Salary advance is required"),
});

export const getSalaryAdvanceReportOptions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("reports:hr-reports");

		const options = await getSalaryAdvanceFormOptionsFn();

		return {
			employees: options.employees.map((employee) => ({
				value: employee.id,
				label: `${employee.fullName} (${employee.employeeNo})`,
			})),
		};
	});

export const getSalaryAdvanceSummaryReport = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryAdvanceSummaryRequestSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:hr-reports");

		const statusFilter = resolveSalaryAdvanceStatuses(data.status);
		const rows = await db
			.select({
				id: salaryAdvances.id,
				fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				applicationDate: salaryAdvances.applicationDate,
				disbursementDate: salaryAdvances.disbursementDate,
				approvedAmount: salaryAdvances.approvedAmount,
				monthlyRecoveryAmount: salaryAdvances.monthlyRecoveryAmount,
				totalRecovered: salaryAdvances.totalRecovered,
				outstandingBalance: salaryAdvances.outstandingBalance,
				recoveriesProcessed: salaryAdvances.recoveriesProcessed,
				approvedRecoveryMonths: salaryAdvances.approvedRecoveryMonths,
				status: salaryAdvances.status,
			})
			.from(salaryAdvances)
			.innerJoin(employees, eq(salaryAdvances.employeeId, employees.id))
			.where(
				and(
					data.employeeId ? eq(salaryAdvances.employeeId, data.employeeId) : undefined,
					statusFilter ? inArray(salaryAdvances.status, statusFilter) : undefined,
					isNull(employees.deletedAt)
				)
			)
			.orderBy(desc(salaryAdvances.applicationDate), desc(salaryAdvances.createdAt));

		return buildSalaryAdvanceSummaryReport(
			rows.map((row) => ({
				id: row.id,
				fullName: row.fullName,
				applicationDate: row.applicationDate,
				disbursementDate: row.disbursementDate,
				approvedAmount: row.approvedAmount === null ? null : toNumber(row.approvedAmount),
				monthlyRecoveryAmount:
					row.monthlyRecoveryAmount === null ? null : toNumber(row.monthlyRecoveryAmount),
				totalRecovered: toNumber(row.totalRecovered),
				outstandingBalance:
					row.outstandingBalance === null ? null : toNumber(row.outstandingBalance),
				recoveriesProcessed: row.recoveriesProcessed,
				approvedRecoveryMonths: row.approvedRecoveryMonths,
				status: row.status,
			}))
		);
	});

export const getSalaryAdvanceStatement = createServerFn()
	.middleware([authMiddleware])
	.validator(salaryAdvanceStatementRequestSchema)
	.handler(async ({ data }) => {
		await requirePermission("reports:hr-reports");

		const [detail, statement, accountRow] = await Promise.all([
			getAdvanceByIdFn({ data: { advanceId: data.advanceId } }),
			getAdvanceRecoveryStatementFn({ data: { advanceId: data.advanceId } }),
			db.query.salaryAdvances.findFirst({
				columns: {},
				where: (salaryAdvanceTable, { eq: innerEq }) =>
					innerEq(salaryAdvanceTable.id, data.advanceId),
				with: {
					disbursementAccount: {
						columns: { name: true },
					},
				},
			}),
		]);

		const rows = buildSalaryAdvanceStatementRows(detail.recoveries, statement.entries);
		const currentPosition = buildSalaryAdvanceStatementCurrentPosition(detail);

		return {
			advanceId: detail.id,
			header: {
				employeeName: detail.fullName,
				employeeNo: detail.employeeNo,
				advanceReference: detail.id,
				applicationDate: detail.applicationDate,
				disbursementDate: detail.disbursementDate,
				disbursementAccountName: accountRow?.disbursementAccount?.name ?? null,
				approvedAmount: detail.approvedAmount ?? 0,
				monthlyRecoveryAmount: detail.monthlyRecoveryAmount ?? 0,
				recoveryStartMonth: detail.recoveryStartMonth,
				recoveryStartYear: detail.recoveryStartYear,
				approvedRecoveryMonths: detail.approvedRecoveryMonths ?? 0,
				status: detail.status,
			},
			rows,
			currentPosition,
		};
	});

export type SalaryAdvanceReportOptionsResponse = Awaited<
	ReturnType<typeof getSalaryAdvanceReportOptions>
>;
export type SalaryAdvanceSummaryReportResponse = Awaited<
	ReturnType<typeof getSalaryAdvanceSummaryReport>
>;
export type SalaryAdvanceStatementResponse = Awaited<ReturnType<typeof getSalaryAdvanceStatement>>;
