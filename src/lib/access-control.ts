import { and, type ExtractTablesWithRelations, eq, isNull } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { db } from "@/drizzle/db";
import type * as schema from "@/drizzle/schema";
import {
	accessControlSyncJobs,
	biotimePersonProfiles,
	employees,
	members,
	users,
} from "@/drizzle/schema";

type Transaction = PgTransaction<
	NodePgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

type DbExecutor = typeof db | Transaction;

function generateDeletedMemberContact(memberId: string) {
	return `deleted_${memberId.slice(0, 7)}`;
}

function generateDeletedEmployeePhone(employeeId: string) {
	return `deleted_${employeeId.slice(0, 12)}`;
}

export async function softDeleteMemberLocally({
	memberId,
	tx = db,
}: {
	memberId: string;
	tx?: DbExecutor;
}) {
	const member = await tx.query.members.findFirst({
		where: and(eq(members.id, memberId), isNull(members.deletedAt)),
	});

	if (!member) {
		return {
			deleted: false,
			reason: "Member not found",
		} as const;
	}

	await tx
		.update(members)
		.set({
			email: null,
			contact: generateDeletedMemberContact(member.id),
			completedRegistration: false,
			firstName: `deleted_member_${member.id}`,
			emergencyContactNo: null,
			emergencyContactName: null,
			lastName: `deleted_member_${member.id}`,
			dateOfBirth: null,
			emergencyContactRelationship: null,
			gender: "unspecified",
			address: null,
			city: null,
			country: null,
			idNumber: null,
			idType: null,
			image: null,
			memberStatus: "inactive",
			zipCode: null,
			state: null,
			notes: null,
			deviceId: null,
			deletedAt: new Date(),
		})
		.where(eq(members.id, memberId));

	await tx.delete(users).where(eq(users.memberId, memberId));

	return {
		deleted: true,
		member,
	} as const;
}

export async function softDeleteEmployeeLocally({
	employeeId,
	tx = db,
}: {
	employeeId: string;
	tx?: DbExecutor;
}) {
	const employee = await tx.query.employees.findFirst({
		where: and(eq(employees.id, employeeId), isNull(employees.deletedAt)),
	});

	if (!employee) {
		return {
			deleted: false,
			reason: "Employee not found",
		} as const;
	}

	await tx
		.update(employees)
		.set({
			firstName: `deleted_employee_${employee.id}`,
			lastName: `deleted_employee_${employee.id}`,
			gender: "unspecified",
			nationalId: null,
			dateOfBirth: null,
			kraPin: null,
			nssfNo: null,
			shifNo: null,
			helbRef: null,
			phone: generateDeletedEmployeePhone(employee.id),
			email: null,
			emergencyContact: null,
			nextOfKin: null,
			jobTitle: null,
			departmentId: null,
			status: "terminated",
			terminationDate: new Date().toISOString().slice(0, 10),
			bankName: null,
			bankAccountNo: null,
			bankBranch: null,
			deletedAt: new Date(),
		})
		.where(eq(employees.id, employeeId));

	return {
		deleted: true,
		employee,
	} as const;
}

type QueueDeleteBioTimePersonInput =
	| {
			personType: "member";
			memberId: string;
	  }
	| {
			personType: "employee";
			employeeId: string;
	  };

export async function queueDeleteBioTimePerson(
	input: QueueDeleteBioTimePersonInput,
) {
	const now = new Date();

	return db.transaction(async (tx) => {
		const profile = await tx.query.biotimePersonProfiles.findFirst({
			where:
				input.personType === "member"
					? and(
							eq(biotimePersonProfiles.memberId, input.memberId),
							eq(biotimePersonProfiles.personType, "member"),
						)
					: and(
							eq(biotimePersonProfiles.employeeId, input.employeeId),
							eq(biotimePersonProfiles.personType, "employee"),
						),
		});

		if (!profile) {
			const result =
				input.personType === "member"
					? await softDeleteMemberLocally({
							memberId: input.memberId,
							tx,
						})
					: await softDeleteEmployeeLocally({
							employeeId: input.employeeId,
							tx,
						});

			return {
				queued: false,
				deletedLocally: result.deleted,
				reason: result.deleted ? "No BioTime profile found" : result.reason,
			};
		}

		if (!profile.biotimeEmployeeId) {
			await tx
				.delete(biotimePersonProfiles)
				.where(eq(biotimePersonProfiles.id, profile.id));

			const result =
				input.personType === "member"
					? await softDeleteMemberLocally({
							memberId: input.memberId,
							tx,
						})
					: await softDeleteEmployeeLocally({
							employeeId: input.employeeId,
							tx,
						});

			return {
				queued: false,
				deletedLocally: result.deleted,
				reason: result.deleted
					? "BioTime employee ID was not available"
					: result.reason,
			};
		}

		await tx
			.update(biotimePersonProfiles)
			.set({
				desiredAccessEnabled: false,
				accessControlStatus: "pending_delete",
				lastSyncError: null,
				updatedAt: now,
			})
			.where(eq(biotimePersonProfiles.id, profile.id));

		await tx.insert(accessControlSyncJobs).values({
			biotimePersonProfileId: profile.id,
			personType: input.personType,
			memberId: input.personType === "member" ? input.memberId : null,
			employeeId: input.personType === "employee" ? input.employeeId : null,
			action: "DELETE_EMPLOYEE",
			status: "pending",
			payload: {
				biotimeEmployeeId: profile.biotimeEmployeeId,
				biotimeEmployeeCode: profile.biotimeEmployeeCode,
				personType: input.personType,
				memberId: input.personType === "member" ? input.memberId : null,
				employeeId: input.personType === "employee" ? input.employeeId : null,
				deleteLocalAfterSuccess: true,
			},
			idempotencyKey: `DELETE_EMPLOYEE:${input.personType}:${profile.id}`,
			createdAt: now,
			updatedAt: now,
		});

		return {
			queued: true,
			deletedLocally: false,
			biotimePersonProfileId: profile.id,
		};
	});
}
