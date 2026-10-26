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

// Registration never grants access: status and door access follow the member's
// memberships (see reconcileMemberState), whatever status the form carried.
export function buildNewMemberValues(memberData: ReturnType<typeof mapMemberData>, memberNo: number) {
	return { ...memberData, memberStatus: "inactive" as const, memberNo };
}

// The BioTime person is still created so a face or fingerprint can be enrolled,
// but with access off until a membership turns it on.
export function buildNewMemberProfileValues({
	memberId,
	empCode,
	payload,
	authorizedAreaId,
	unauthorizedAreaId,
}: {
	memberId: string;
	empCode: string;
	payload: Record<string, unknown>;
	authorizedAreaId: number;
	unauthorizedAreaId: number;
}) {
	return {
		personType: "member" as const,
		memberId,
		employeeId: null,
		biotimeEmployeeCode: empCode,
		biotimeDepartmentId: 1,
		authorizedAreaId,
		unauthorizedAreaId,
		desiredAccessEnabled: false,
		accessControlStatus: "pending_sync" as const,
		biometricEnrollmentStatus: "pending" as const,
		lastSyncPayload: payload,
	};
}

// The insert half of member creation: memberNo, the members row (inactive),
// the BioTime profile (access off) and the CREATE_EMPLOYEE sync job. Callers own the transaction,
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
	const authorizedAreaId = settings?.authorizedAreaId ?? 2;
	const unauthorizedAreaId = settings?.unauthorizedAreaId ?? 1;

	const [member] = await tx
		.insert(members)
		.values(buildNewMemberValues(memberData, memberNo))
		.returning();

	const empCode = generateBioTimeEmployeeCode(memberNo);

	const payload = {
		empCode,
		firstName: member.firstName,
		lastName: member.lastName,
		departmentId: 1,
		// The person is created in the unauthorized area so a face or fingerprint
		// can be enrolled without opening the door.
		areaIds: [unauthorizedAreaId],
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
		.values(buildNewMemberProfileValues({
				memberId: member.id,
				empCode,
				payload,
				authorizedAreaId,
				unauthorizedAreaId,
			}))
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
