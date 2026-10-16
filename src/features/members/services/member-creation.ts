import { and, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	accessControlSyncJobs,
	biotimePersonProfiles,
	members,
} from "@/drizzle/schema";
import type { MemberFormSchema } from "@/features/members/services/schemas";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";
import { ConflictError } from "@/lib/error-handling/app-error";

export function generateBioTimeEmployeeCode(memberNo: number) {
	return `M${String(memberNo).padStart(6, "0")}`;
}

export function mapMemberData(data: MemberFormSchema) {
	const {
		firstName,
		lastName,
		dateOfBirth,
		gender,
		email,
		contact,
		idType,
		idNumber,
		memberStatus,
		emergencyContactName,
		emergencyContactNo,
		emergencyContactRelationship,
		notes,
	} = data;

	return {
		firstName,
		lastName,
		dateOfBirth: dateOfBirth ? dateOfBirth : null,
		gender: gender ?? undefined,
		email: email ?? undefined,
		contact,
		idType: idType ?? undefined,
		idNumber: !idType ? null : idNumber,
		memberStatus,
		emergencyContactName: emergencyContactName ?? undefined,
		emergencyContactNo: emergencyContactNo ?? undefined,
		emergencyContactRelationship: emergencyContactRelationship ?? undefined,
		notes: notes ?? undefined,
	};
}

export async function nextMemberNo(executor: Pick<typeof db, "select"> = db) {
	const [row] = await executor
		.select({ memberNo: sql<number>`COALESCE(MAX(${members.memberNo}), 1000)` })
		.from(members);
	return row.memberNo + 1;
}

// The insert half of member creation: memberNo, the members row, the BioTime
// profile and the CREATE_EMPLOYEE sync job. Callers own the transaction,
// activity logging and any post-commit side effects (e.g. the registration
// link SMS), so this can be reused by flows that must not send them.
export async function insertMemberRecord({
	tx,
	data,
}: {
	tx: Transaction;
	data: MemberFormSchema;
}) {
	const memberNo = await nextMemberNo(tx);
	const memberData = mapMemberData(data);

	const settings = await tx.query.biotimeSettings.findFirst();

	const [member] = await tx
		.insert(members)
		.values({
			...memberData,
			memberNo,
		})
		.returning();

	const empCode = generateBioTimeEmployeeCode(memberNo);

	const payload = {
		empCode,
		firstName: member.firstName,
		lastName: member.lastName,
		departmentId: 1,
		areaIds: [settings?.authorizedAreaId ?? 2],
		mobile: member.contact,
		email: member.email,
		gender: member.gender,
		birthday: member.dateOfBirth,
		employeeType: 1,
	};

	const existingProfile = await tx.query.biotimePersonProfiles.findFirst({
		where: and(
			eq(biotimePersonProfiles.memberId, member.id),
			eq(biotimePersonProfiles.personType, "member"),
		),
	});

	if (existingProfile) {
		throw new ConflictError("Access Control Profile already exists");
	}

	const [profile] = await tx
		.insert(biotimePersonProfiles)
		.values({
			personType: "member",
			memberId: member.id,
			employeeId: null,
			biotimeEmployeeCode: empCode,
			biotimeDepartmentId: 1,
			authorizedAreaId: 2,
			unauthorizedAreaId: 1,
			desiredAccessEnabled: true,
			accessControlStatus: "pending_sync",
			biometricEnrollmentStatus: "pending",
			lastSyncPayload: payload,
		})
		.returning();

	await tx.insert(accessControlSyncJobs).values({
		biotimePersonProfileId: profile.id,
		memberId: member.id,
		action: "CREATE_EMPLOYEE",
		status: "pending",
		payload,
		idempotencyKey: `CREATE_EMPLOYEE:${profile.id}:${empCode}`,
	});

	return member;
}
