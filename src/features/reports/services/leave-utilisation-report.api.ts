import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { departments, employeeLeaveBalances, employees } from "@/drizzle/schema";
import { buildLeaveUtilisationReport } from "@/features/reports/lib/leave-utilisation-report";
import { toNumber } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

const leaveUtilisationRequestSchema = z.object({
	leaveYear: z.coerce.number().int().min(2000).max(9999),
	departmentId: z.coerce.number().int().positive().optional(),
	employeeId: z.string().trim().optional(),
});

async function requireLeaveUtilisationAccess() {
	await requirePermission("leaves:view");
}

export const getLeaveUtilisationReportOptions = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requireLeaveUtilisationAccess();

		const currentYear = new Date().getFullYear();
		const [leaveYearRows, departmentRows, employeeRows] = await Promise.all([
			db
				.selectDistinct({
					leaveYear: employeeLeaveBalances.leaveYear,
				})
				.from(employeeLeaveBalances)
				.orderBy(desc(employeeLeaveBalances.leaveYear)),
			db
				.select({
					id: departments.id,
					name: departments.name,
				})
				.from(departments)
				.orderBy(asc(departments.name)),
			db
				.select({
					id: employees.id,
					departmentId: employees.departmentId,
					employeeNo: employees.employeeNo,
					fullName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				})
				.from(employees)
				.where(isNull(employees.deletedAt))
				.orderBy(asc(employees.lastName), asc(employees.firstName)),
		]);

		const leaveYears = Array.from(
			new Set([currentYear, ...leaveYearRows.map((row) => row.leaveYear)])
		).sort((left, right) => right - left);

		return {
			leaveYears,
			departments: departmentRows.map((department) => ({
				value: department.id.toString(),
				label: department.name,
			})),
			employees: employeeRows.map((employee) => ({
				value: employee.id,
				label: `${employee.fullName} (${employee.employeeNo})`,
			})),
		};
	});

export const getLeaveUtilisationReport = createServerFn()
	.middleware([authMiddleware])
	.validator(leaveUtilisationRequestSchema)
	.handler(async ({ data }) => {
		await requireLeaveUtilisationAccess();

		const rows = await db
			.select({
				employeeId: employees.id,
				employeeName: sql<string>`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
				employeeNo: employees.employeeNo,
				departmentName: departments.name,
				leaveType: employeeLeaveBalances.leaveType,
				entitledDays: employeeLeaveBalances.entitledDays,
				carriedForwardDays: employeeLeaveBalances.carriedForwardDays,
				adjustmentDays: employeeLeaveBalances.adjustmentDays,
				takenDays: employeeLeaveBalances.takenDays,
				carryForwardExpiresAt: employeeLeaveBalances.carryForwardExpiresAt,
			})
			.from(employeeLeaveBalances)
			.innerJoin(employees, eq(employeeLeaveBalances.employeeId, employees.id))
			.leftJoin(departments, eq(employees.departmentId, departments.id))
			.where(
				and(
					eq(employeeLeaveBalances.leaveYear, data.leaveYear),
					data.departmentId ? eq(employees.departmentId, data.departmentId) : undefined,
					data.employeeId ? eq(employees.id, data.employeeId) : undefined,
					isNull(employees.deletedAt)
				)
			)
			.orderBy(
				asc(sql`coalesce(${departments.name}, '')`),
				asc(employees.lastName),
				asc(employees.firstName),
				asc(employeeLeaveBalances.leaveType)
			);

		return buildLeaveUtilisationReport(
			rows.map((row) => ({
				employeeId: row.employeeId,
				employeeName: row.employeeName,
				employeeNo: row.employeeNo,
				departmentName: row.departmentName,
				leaveType: row.leaveType,
				entitledDays: toNumber(row.entitledDays),
				carriedForwardDays: toNumber(row.carriedForwardDays),
				adjustmentDays: toNumber(row.adjustmentDays),
				takenDays: toNumber(row.takenDays),
				carryForwardExpiresAt: row.carryForwardExpiresAt,
			})),
			data.leaveYear
		);
	});

export type LeaveUtilisationReportOptionsResponse = Awaited<
	ReturnType<typeof getLeaveUtilisationReportOptions>
>;
export type LeaveUtilisationReportResponse = Awaited<
	ReturnType<typeof getLeaveUtilisationReport>
>;
