import { createServerFn } from "@tanstack/react-start";
import {
	and,
	desc,
	eq,
	ilike,
	isNull,
	ne,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import z from "zod";
import { db } from "@/drizzle/db";
import {
	accessControlSyncJobs,
	biotimePersonProfiles,
	employees,
} from "@/drizzle/schema";
import {
	getNextEmployeeNumber,
	normalizeEmployeeFormValues,
} from "@/features/employees/utils/helpers";
import type { EmployeeSchema } from "@/features/employees/utils/schemas";
import { employeeSchema } from "@/features/employees/utils/schemas";
import { queueDeleteBioTimePerson } from "@/lib/access-control";
import {
	requireAnyPermission,
	requirePermission,
} from "@/lib/permissions/permissions";
import { hasPermission } from "@/lib/permissions/permissions-service";
import { failure, success } from "@/lib/result";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

type EmployeeRecord = typeof employees.$inferSelect;

type PayrollRestrictedValues = Pick<
	EmployeeRecord,
	| "nationalId"
	| "kraPin"
	| "nssfNo"
	| "shifNo"
	| "helbRef"
	| "jobTitle"
	| "departmentId"
	| "employmentType"
	| "hireDate"
	| "terminationDate"
	| "bankName"
	| "bankAccountNo"
	| "bankBranch"
	| "isResident"
>;

const employeeUniqueFieldDefinitions = [
	{
		key: "phone",
		column: employees.phone,
		label: "Phone number",
	},
	{
		key: "email",
		column: employees.email,
		label: "Email address",
	},
	{
		key: "nationalId",
		column: employees.nationalId,
		label: "National ID",
	},
	{
		key: "kraPin",
		column: employees.kraPin,
		label: "KRA PIN",
	},
	{
		key: "nssfNo",
		column: employees.nssfNo,
		label: "NSSF number",
	},
	{
		key: "shifNo",
		column: employees.shifNo,
		label: "SHIF number",
	},
	{
		key: "helbRef",
		column: employees.helbRef,
		label: "HELB reference",
	},
] as const satisfies Array<{
	key: keyof Pick<
		EmployeeSchema,
		| "phone"
		| "email"
		| "nationalId"
		| "kraPin"
		| "nssfNo"
		| "shifNo"
		| "helbRef"
	>;
	column:
		| typeof employees.phone
		| typeof employees.email
		| typeof employees.nationalId
		| typeof employees.kraPin
		| typeof employees.nssfNo
		| typeof employees.shifNo
		| typeof employees.helbRef;
	label: string;
}>;

function generateBioTimeEmployeeCode(memberNo: string) {
	return `E${String(memberNo).padStart(6, "0")}`;
}

function getDefaultPayrollRestrictedValues(): PayrollRestrictedValues {
	return {
		nationalId: null,
		kraPin: null,
		nssfNo: null,
		shifNo: null,
		helbRef: null,
		jobTitle: null,
		departmentId: null,
		employmentType: "full_time",
		hireDate: null,
		terminationDate: null,
		bankName: null,
		bankAccountNo: null,
		bankBranch: null,
		isResident: true,
	};
}

function getPayrollRestrictedValues({
	data,
	canManagePayrollInformation,
	existingEmployee,
}: {
	data: EmployeeSchema;
	canManagePayrollInformation: boolean;
	existingEmployee?: EmployeeRecord | null;
}): PayrollRestrictedValues {
	if (canManagePayrollInformation) {
		return {
			nationalId: data.nationalId ?? null,
			kraPin: data.kraPin ?? null,
			nssfNo: data.nssfNo ?? null,
			shifNo: data.shifNo ?? null,
			helbRef: data.helbRef ?? null,
			jobTitle: data.jobTitle ?? null,
			departmentId: data.departmentId ?? null,
			employmentType: data.employmentType,
			hireDate: data.hireDate ?? null,
			terminationDate: data.terminationDate ?? null,
			bankName: data.bankName ?? null,
			bankAccountNo: data.bankAccountNo ?? null,
			bankBranch: data.bankBranch ?? null,
			isResident: data.isResident,
		};
	}

	if (existingEmployee) {
		return {
			nationalId: existingEmployee.nationalId,
			kraPin: existingEmployee.kraPin,
			nssfNo: existingEmployee.nssfNo,
			shifNo: existingEmployee.shifNo,
			helbRef: existingEmployee.helbRef,
			jobTitle: existingEmployee.jobTitle,
			departmentId: existingEmployee.departmentId,
			employmentType: existingEmployee.employmentType,
			hireDate: existingEmployee.hireDate,
			terminationDate: existingEmployee.terminationDate,
			bankName: existingEmployee.bankName,
			bankAccountNo: existingEmployee.bankAccountNo,
			bankBranch: existingEmployee.bankBranch,
			isResident: existingEmployee.isResident,
		};
	}

	return getDefaultPayrollRestrictedValues();
}

function buildEmployeeValues({
	data,
	employeeNo,
	canManagePayrollInformation,
	existingEmployee,
}: {
	data: EmployeeSchema;
	employeeNo: string;
	canManagePayrollInformation: boolean;
	existingEmployee?: EmployeeRecord | null;
}) {
	const payrollRestrictedValues = getPayrollRestrictedValues({
		data,
		canManagePayrollInformation,
		existingEmployee,
	});

	return {
		employeeNo,
		firstName: data.firstName,
		lastName: data.lastName,
		gender: data.gender,
		dateOfBirth: data.dateOfBirth ?? null,
		phone: data.phone,
		email: data.email ?? null,
		emergencyContact: data.emergencyContact ?? null,
		nextOfKin: data.nextOfKin ?? null,
		status: data.status,
		...payrollRestrictedValues,
	};
}

async function getAllEmployeeNumbers() {
	const employeeNumbers = await db
		.select({
			employeeNo: employees.employeeNo,
		})
		.from(employees);

	return employeeNumbers.map((employee) => employee.employeeNo);
}

async function getNextEmployeeNoValue() {
	return getNextEmployeeNumber(await getAllEmployeeNumbers());
}

async function employeeNoExists(
	employeeNo: string,
	excludeEmployeeId?: string,
) {
	const employee = await db.query.employees.findFirst({
		columns: {
			id: true,
		},
		where: and(
			eq(employees.employeeNo, employeeNo),
			isNull(employees.deletedAt),
			excludeEmployeeId ? ne(employees.id, excludeEmployeeId) : undefined,
		),
	});

	return Boolean(employee);
}

async function getEmployeeConflictMessage(
	data: Pick<
		EmployeeRecord,
		| "phone"
		| "email"
		| "nationalId"
		| "kraPin"
		| "nssfNo"
		| "shifNo"
		| "helbRef"
	>,
	excludeEmployeeId?: string,
) {
	const filters = employeeUniqueFieldDefinitions
		.map(({ key, column }) => {
			const value = data[key] ?? null;

			return value ? eq(column, value) : undefined;
		})
		.filter((filter): filter is SQL => Boolean(filter));

	if (!filters.length) {
		return null;
	}

	const conflictingEmployee = await db.query.employees.findFirst({
		columns: {
			id: true,
			phone: true,
			email: true,
			nationalId: true,
			kraPin: true,
			nssfNo: true,
			shifNo: true,
			helbRef: true,
		},
		where: and(
			or(...filters),
			isNull(employees.deletedAt),
			excludeEmployeeId ? ne(employees.id, excludeEmployeeId) : undefined,
		),
	});

	if (!conflictingEmployee) {
		return null;
	}

	for (const field of employeeUniqueFieldDefinitions) {
		const value = data[field.key] ?? null;
		if (value && conflictingEmployee[field.key] === value) {
			return `${field.label} already exists`;
		}
	}

	return "Employee details already exist";
}

function isEmployeeNumberUniqueViolation(error: unknown) {
	return Boolean(
		error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "23505" &&
			"constraint" in error &&
			typeof error.constraint === "string" &&
			error.constraint.includes("employee_no"),
	);
}

async function createEmployee({
	data,
	loggedUserId,
	canManagePayrollInformation,
}: {
	data: EmployeeSchema;
	loggedUserId: string;
	canManagePayrollInformation: boolean;
}) {
	await requirePermission("employees:create");

	const employeeValues = buildEmployeeValues({
		data,
		employeeNo: data.employeeNo,
		canManagePayrollInformation,
	});

	const conflictMessage = await getEmployeeConflictMessage(employeeValues);
	if (conflictMessage) {
		return failure({
			type: "ConflictError",
			message: conflictMessage,
		});
	}

	let employeeNo = await getNextEmployeeNoValue();

	for (let attempt = 0; attempt < 3; attempt++) {
		if (await employeeNoExists(employeeNo)) {
			employeeNo = await getNextEmployeeNoValue();
			continue;
		}

		try {
			const settings = await db.query.biotimeSettings.findFirst();
			const isNotActive =
				data.status === "resigned" || data.status === "terminated";

			const employeeResult = await db.transaction(async (tx) => {
				const [employee] = await tx
					.insert(employees)
					.values({
						...employeeValues,
						employeeNo,
					})
					.returning();

				const empCode = generateBioTimeEmployeeCode(employeeNo);

				const payload = {
					empCode,
					firstName: employee.firstName,
					lastName: employee.lastName,
					departmentId: 2,
					areaIds: [settings?.authorizedAreaId ?? 2],
					employeeType: 1,
				};

				const [profile] = await tx
					.insert(biotimePersonProfiles)
					.values({
						personType: "employee",
						employeeId: employee.id,
						biotimeEmployeeCode: empCode,
						biotimeDepartmentId: 2,
						authorizedAreaId: settings?.authorizedAreaId ?? 2,
						unauthorizedAreaId: settings?.unauthorizedAreaId ?? 1,
						desiredAccessEnabled: !isNotActive,
						accessControlStatus: "pending_sync",
						biometricEnrollmentStatus: "pending",
						lastSyncPayload: payload,
					})
					.returning();

				await tx.insert(accessControlSyncJobs).values({
					biotimePersonProfileId: profile.id,
					personType: "employee",
					employeeId: employee.id,
					action: "CREATE_EMPLOYEE",
					status: "pending",
					payload,
					idempotencyKey: `CREATE_EMPLOYEE:${profile.id}:${empCode}`,
				});

				return { employeeNo: String(employee.employeeNo) };
			});

			await logActivity({
				data: {
					action: "create employee",
					description: `Created employee ${employeeResult.employeeNo} - ${data.firstName} ${data.lastName}`,
					userId: loggedUserId,
				},
			});

			return success(undefined);
		} catch (error) {
			if (isEmployeeNumberUniqueViolation(error)) {
				employeeNo = await getNextEmployeeNoValue();
				continue;
			}

			console.error(error);
			return failure({
				type: "ApplicationError",
				message: "Failed to create employee",
			});
		}
	}

	return failure({
		type: "ConflictError",
		message: "Unable to generate a unique employee number. Please try again.",
	});
}

async function updateEmployee({
	data,
	loggedUserId,
	canManagePayrollInformation,
}: {
	data: EmployeeSchema;
	loggedUserId: string;
	canManagePayrollInformation: boolean;
}) {
	await requirePermission("employees:update");

	if (!data.id) {
		return failure({
			type: "ValidationError",
			message: "Employee id is required",
		});
	}

	const existingEmployee = await db.query.employees.findFirst({
		where: and(eq(employees.id, data.id), isNull(employees.deletedAt)),
	});

	if (!existingEmployee) {
		return failure({
			type: "NotFoundError",
			message: "Employee not found",
		});
	}

	const employeeValues = buildEmployeeValues({
		data,
		employeeNo: existingEmployee.employeeNo,
		canManagePayrollInformation,
		existingEmployee,
	});

	const conflictMessage = await getEmployeeConflictMessage(
		employeeValues,
		data.id,
	);
	if (conflictMessage) {
		return failure({
			type: "ConflictError",
			message: conflictMessage,
		});
	}

	try {
		await db.transaction(async (tx) => {
			await tx
				.update(employees)
				.set(employeeValues)
				.where(eq(employees.id, existingEmployee.id));

			const employeeProfile = await tx.query.biotimePersonProfiles.findFirst({
				where: and(
					eq(biotimePersonProfiles.employeeId, existingEmployee.id),
					eq(biotimePersonProfiles.personType, "employee"),
				),
			});

			if (employeeProfile) {
				const wasTerminal =
					existingEmployee.status === "resigned" ||
					existingEmployee.status === "terminated";
				const isTerminal =
					data.status === "resigned" || data.status === "terminated";

				if (!wasTerminal && isTerminal) {
					await tx
						.update(biotimePersonProfiles)
						.set({
							desiredAccessEnabled: false,
							accessControlStatus: "pending_sync",
							currentAreaId: employeeProfile.unauthorizedAreaId,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(biotimePersonProfiles.employeeId, existingEmployee.id),
								eq(biotimePersonProfiles.personType, "employee"),
							),
						);

					await tx.insert(accessControlSyncJobs).values({
						biotimePersonProfileId: employeeProfile.id,
						personType: "employee",
						employeeId: existingEmployee.id,
						action: "RESIGN_EMPLOYEE",
						status: "pending",
						payload: {
							biotimeEmployeeId: employeeProfile.biotimeEmployeeId,
							resignDate: new Date().toISOString().slice(0, 10),
							resignType: 1,
							disableAttendance: true,
							reason:
								data.status === "resigned"
									? "membership_expired"
									: "employment_terminated",
						},
						idempotencyKey: `RESIGN_EMPLOYEE:employee:${employeeProfile.id}:${new Date().toISOString().slice(0, 10)}`,
					});
				}

				if (
					data.status === "active" &&
					(existingEmployee.status === "terminated" ||
						existingEmployee.status === "resigned")
				) {
					await tx
						.update(biotimePersonProfiles)
						.set({
							desiredAccessEnabled: true,
							accessControlStatus: "pending_sync",
							currentAreaId: employeeProfile.authorizedAreaId,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(biotimePersonProfiles.employeeId, existingEmployee.id),
								eq(biotimePersonProfiles.personType, "employee"),
							),
						);

					await tx.insert(accessControlSyncJobs).values({
						biotimePersonProfileId: employeeProfile.id,
						personType: "employee",
						employeeId: existingEmployee.id,
						action: "ENABLE_ACCESS",
						status: "pending",
						payload: {
							biotimeEmployeeId: employeeProfile.biotimeEmployeeId,
							areaIds: [employeeProfile.authorizedAreaId],
							reason: "unknown",
						},
						idempotencyKey: `ENABLE_ACCESS:${existingEmployee.id}:${Date.now()}`,
					});
				}
			}
		});

		await logActivity({
			data: {
				action: "update employee",
				description: `Updated employee ${existingEmployee.employeeNo} - ${data.firstName} ${data.lastName}`,
				userId: loggedUserId,
			},
		});

		return success({
			id: existingEmployee.id,
			employeeNo: existingEmployee.employeeNo,
		});
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update employee",
		});
	}
}

export const getNextEmployeeNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePermission("employees:create");
		return getNextEmployeeNoValue();
	});

export const getEmployees = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		await requirePermission("employees:view");

		const filters: Array<SQL> = [];

		if (q) {
			const query = q.trim();
			const searchFilters = or(
				ilike(employees.employeeNo, `%${query}%`),
				ilike(employees.firstName, `%${query}%`),
				ilike(employees.lastName, `%${query}%`),
				ilike(
					sql`concat_ws(' ', ${employees.firstName}, ${employees.lastName})`,
					`%${query}%`,
				),
				ilike(employees.phone, `%${query}%`),
				ilike(employees.email, `%${query}%`),
				ilike(employees.jobTitle, `%${query}%`),
				ilike(sql`CAST(${employees.status} AS TEXT)`, `%${query}%`),
				ilike(sql`CAST(${employees.employmentType} AS TEXT)`, `%${query}%`),
			);

			if (searchFilters) {
				filters.push(searchFilters);
			}
		}

		return db
			.select({
				id: employees.id,
				employeeNo: employees.employeeNo,
				firstName: employees.firstName,
				lastName: employees.lastName,
				phone: employees.phone,
				email: employees.email,
				jobTitle: employees.jobTitle,
				status: employees.status,
				employmentType: employees.employmentType,
				hireDate: employees.hireDate,
			})
			.from(employees)
			.where(and(isNull(employees.deletedAt), ...filters))
			.orderBy(desc(employees.createdAt));
	});

export const getEmployee = createServerFn()
	.middleware([authMiddleware])
	.validator((employeeId: string) => employeeId)
	.handler(async ({ data: employeeId }) => {
		await requireAnyPermission(["employees:view", "employees:update"]);

		const employee = await db.query.employees.findFirst({
			columns: {
				createdAt: false,
				updatedAt: false,
			},
			where: and(eq(employees.id, employeeId), isNull(employees.deletedAt)),
		});

		if (!employee) {
			return null;
		}

		const canManagePayrollInformation = await hasPermission({
			data: "employees:payroll-information",
		});

		if (canManagePayrollInformation) {
			return employee;
		}

		return {
			...employee,
			...getDefaultPayrollRestrictedValues(),
		};
	});

export const upsertEmployee = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(employeeSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			const normalizedData = normalizeEmployeeFormValues(data);
			const canManagePayrollInformation = await hasPermission({
				data: "employees:payroll-information",
			});

			if (normalizedData.id) {
				return updateEmployee({
					data: normalizedData,
					loggedUserId,
					canManagePayrollInformation,
				});
			}

			return createEmployee({
				data: normalizedData,
				loggedUserId,
				canManagePayrollInformation,
			});
		},
	);

export const deleteEmployee = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, "Employee ID is required"))
	.handler(
		async ({
			data: employeeId,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			await requirePermission("employees:delete");

			const existingEmployee = await db.query.employees.findFirst({
				where: and(eq(employees.id, employeeId), isNull(employees.deletedAt)),
			});

			if (!existingEmployee) {
				return failure({
					type: "NotFoundError",
					message: "Employee not found",
				});
			}

			try {
				await queueDeleteBioTimePerson({
					personType: "employee",
					employeeId,
				});

				await logActivity({
					data: {
						action: "delete employee",
						description: `Deleted employee ${existingEmployee.employeeNo} - ${existingEmployee.firstName} ${existingEmployee.lastName}`,
						userId: loggedUserId,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete employee",
				});
			}
		},
	);

export type EmployeeListItem = Awaited<ReturnType<typeof getEmployees>>[number];
