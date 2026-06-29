import { db } from "@/drizzle/db";
import { employees } from "@/drizzle/schema";
import { failure, success } from "@/lib/result";
import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

export async function getEligibleEmployee(employeeId: string) {
	const employee = await db.query.employees.findFirst({
		columns: {
			id: true,
			employeeNo: true,
			firstName: true,
			lastName: true,
			status: true,
			jobTitle: true,
			departmentId: true,
		},
		where: and(
			eq(employees.id, employeeId),
			isNull(employees.deletedAt),
			inArray(employees.status, ["active", "on_leave"])
		),
	});

	if (!employee)
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});

	return success(employee);
}

export function employeeSearchCondition(q: string | undefined | null) {
	const trimmed = q?.trim();
	if (!trimmed) return undefined;

	const pattern = `%${trimmed}%`;

	return or(
		ilike(employees.employeeNo, pattern),
		ilike(employees.firstName, pattern),
		ilike(employees.lastName, pattern),
		ilike(sql`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`, pattern)
	);
}
