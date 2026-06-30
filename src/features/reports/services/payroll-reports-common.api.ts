import { createServerFn } from "@tanstack/react-start";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { payrollPeriods } from "@/drizzle/schema";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";

export const getEligiblePayrollPeriods = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("payroll-periods:view");
		await requirePermission("employees:payroll-information");

		const rows = await db.query.payrollPeriods.findMany({
			columns: { id: true, name: true, periodMonth: true, periodYear: true, status: true },
			where: inArray(payrollPeriods.status, ["paid", "closed"]),
			orderBy: [desc(payrollPeriods.periodYear), desc(payrollPeriods.periodMonth)],
		});

		return rows.map((r) => ({ value: r.id, label: r.name, status: r.status }));
	});

export type EligiblePayrollPeriodsResponse = Awaited<ReturnType<typeof getEligiblePayrollPeriods>>;
