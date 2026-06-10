import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	accessControlSyncJobs,
	memberAccessProfiles,
	members,
	users,
} from "@/drizzle/schema";
import {
	type MemberFormSchema,
	memberFormSchema,
	memberRevokePortalAccessSchema,
	memberToggleActiveSchema,
} from "@/features/members/services/schemas";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { inngest } from "@/lib/inngest/client";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import {
	checkColumnExists,
	getMember,
	getMemberNo,
} from "./members.queries.api";

function generateBioTimeEmployeeCode(memberNo: number) {
	return `M${String(memberNo).padStart(6, "0")}`;
}

const createMember = async ({
	data,
	loggedUserId,
}: {
	data: MemberFormSchema;
	loggedUserId: string;
}) => {
	await requirePermission("members:create");
	try {
		await validateMemberUniqueness({
			contact: data.contact,
			idNumber: data.idNumber,
		});

		const memberNo = await getMemberNo();
		const memberData = mapMemberData(data);

		const settings = await db.query.biotimeSettings.findFirst();

		const memberId = await db.transaction(async (tx) => {
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
				departmentId: settings?.defaultDepartmentId ?? 1,
				areaIds: [settings?.authorizedAreaId ?? 2],
				mobile: member.contact,
				email: member.email,
				gender: member.gender,
				birthday: member.dateOfBirth,
				employeeType: 2,
			};

			const existingProfile = await db.query.memberAccessProfiles.findFirst({
				where: eq(memberAccessProfiles.memberId, member.id),
			});

			if (existingProfile) {
				throw new ConflictError("Access Control Profile already exists");
			}

			await tx.insert(memberAccessProfiles).values({
				memberId: member.id,
				biotimeEmployeeCode: empCode,
				biotimeDepartmentId: settings?.defaultDepartmentId ?? 1,
				authorizedAreaId: settings?.authorizedAreaId ?? 2,
				unauthorizedAreaId: settings?.unauthorizedAreaId ?? 1,
				currentAreaId: null,
				desiredAccessEnabled: true,
				accessControlStatus: "pending_sync",
				biometricEnrollmentStatus: "pending",
				lastSyncPayload: payload,
			});

			await tx.insert(accessControlSyncJobs).values({
				memberId: member.id,
				action: "CREATE_EMPLOYEE",
				status: "pending",
				payload,
				idempotencyKey: `CREATE_EMPLOYEE:${member.id}:${empCode}`,
			});

			await logActivity({
				data: {
					action: "create member",
					description: `Created member ${data.firstName} ${data.lastName}`,
					userId: loggedUserId,
				},
			});

			return member.id;
		});

		await inngest.send({
			name: "app/members.send.registration.link",
			data: {
				memberId,
			},
		});

		return success(undefined);
	} catch (err) {
		console.error(err);
		return failure({
			type: "ApplicationError",
			message: "Failed to create member",
		});
	}
};

const updateMember = async ({
	value,
	id,
	loggedUserId,
}: {
	value: MemberFormSchema;
	id: string;
	loggedUserId: string;
}) => {
	try {
		await requirePermission("members:update");

		await validateMemberUniqueness({
			contact: value.contact,
			idNumber: value.idNumber,
			memberId: id,
		});

		const memberData = mapMemberData(value);

		const member = await db.query.members.findFirst({
			where: eq(members.id, id),
		});

		if (!member) {
			return failure({ type: "NotFoundError", message: "Member not found" });
		}

		await db.transaction(async (tx) => {
			await tx.update(members).set(memberData).where(eq(members.id, id));

			await tx
				.update(users)
				.set({
					name: `${value.firstName} ${value.lastName}`,
					contact: value.contact,
					email: value.email,
					active: value.memberStatus === "active",
				})
				.where(eq(users.memberId, id));

			const memberProfile = await tx.query.memberAccessProfiles.findFirst({
				where: eq(memberAccessProfiles.memberId, id),
			});

			if (memberProfile) {
				if (
					value.memberStatus !== "active" &&
					member.memberStatus === "active"
				) {
					await tx
						.update(memberAccessProfiles)
						.set({
							desiredAccessEnabled: false,
							accessControlStatus: "pending_sync",
							currentAreaId: memberProfile.unauthorizedAreaId,
							updatedAt: new Date(),
						})
						.where(eq(memberAccessProfiles.memberId, member.id));

					await tx.insert(accessControlSyncJobs).values({
						memberId: member.id,
						action: "DISABLE_ACCESS",
						status: "pending",
						payload: {
							biotimeEmployeeId: memberProfile.biotimeEmployeeId,
							areaIds: [memberProfile.unauthorizedAreaId],
							reason: "membership_expired",
						},
						idempotencyKey: `DISABLE_ACCESS:${member.id}:${Date.now()}`,
					});
				}

				if (
					value.memberStatus === "active" &&
					member.memberStatus !== "active"
				) {
					await tx
						.update(memberAccessProfiles)
						.set({
							desiredAccessEnabled: true,
							accessControlStatus: "pending_sync",
							currentAreaId: memberProfile.authorizedAreaId,
							updatedAt: new Date(),
						})
						.where(eq(memberAccessProfiles.memberId, member.id));

					await tx.insert(accessControlSyncJobs).values({
						memberId: member.id,
						action: "ENABLE_ACCESS",
						status: "pending",
						payload: {
							biotimeEmployeeId: memberProfile.biotimeEmployeeId,
							areaIds: [memberProfile.authorizedAreaId],
							reason: "membership_paid_or_reactivated",
						},
						idempotencyKey: `ENABLE_ACCESS:${member.id}:${Date.now()}`,
					});
				}
			}

			await logActivity({
				data: {
					action: "update member",
					description: `Updated member ${value.firstName} ${value.lastName} details`,
					userId: loggedUserId,
				},
			});
		});

		return success(undefined);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update member",
		});
	}
};

export const upsertMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(memberFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			if (data.id) {
				return updateMember({ value: data, id: data.id, loggedUserId });
			}
			return createMember({ data, loggedUserId });
		},
	);

export const revokePortalAccess = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(memberRevokePortalAccessSchema)
	.handler(
		async ({
			data: { memberId, revokeReason, banned },
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			const member = await getMember({ data: memberId });
			if (!member) {
				throw new NotFoundError("Member not found");
			}

			const user = await db.query.users.findFirst({
				columns: { id: true, name: true },
				where: eq(users.memberId, memberId),
			});
			if (!user) {
				throw new NotFoundError("User");
			}

			await db.transaction(async (tx) => {
				await tx
					.update(users)
					.set({ banned: !banned, banReason: revokeReason ?? null })
					.where(eq(users.id, user.id));

				await tx
					.update(members)
					.set({ deletedAt: new Date() })
					.where(and(eq(members.id, member.id), isNull(members.deletedAt)));

				const memberProfile = await db.query.memberAccessProfiles.findFirst({
					where: eq(memberAccessProfiles.memberId, memberId),
				});

				if (memberProfile) {
					await tx
						.update(memberAccessProfiles)
						.set({
							desiredAccessEnabled: false,
							accessControlStatus: "pending_sync",
							currentAreaId: 1,
							updatedAt: new Date(),
						})
						.where(eq(memberAccessProfiles.memberId, member.id));

					await tx.insert(accessControlSyncJobs).values({
						memberId: member.id,
						action: "DISABLE_ACCESS",
						status: "pending",
						payload: {
							biotimeEmployeeId: memberProfile.biotimeEmployeeId,
							areaIds: [memberProfile.unauthorizedAreaId],
							reason: "member_deletedd",
						},
						idempotencyKey: `DISABLE_ACCESS:${member.id}:${Date.now()}`,
					});
				}

				await logActivity({
					data: {
						action: "revoke portal access",
						description: `Revoked portal access for member ${user.name}`,
						userId: loggedUserId,
					},
				});
			});

			return memberId;
		},
	);

export const sendRegistrationLink = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, "member id is required"))
	.handler(
		async ({
			data: memberId,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			const member = await getMember({ data: memberId });
			if (!member) {
				throw new NotFoundError("Member not found");
			}

			await inngest.send({
				name: "app/members.send.registration.link",
				data: {
					memberId,
				},
			});

			await logActivity({
				data: {
					action: "send registration link",
					description: `Sent registration link to member ${member.firstName} ${member.lastName}`,
					userId: loggedUserId,
				},
			});
		},
	);

export const toggleActive = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(memberToggleActiveSchema)
	.handler(
		async ({
			data: { memberId, active },
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			if (!(await getMember({ data: memberId }))) {
				throw new NotFoundError("Member");
			}

			const user = await db.query.users.findFirst({
				columns: { id: true, name: true },
				where: eq(users.memberId, memberId),
			});
			if (!user) {
				throw new NotFoundError("User");
			}

			await db.transaction(async (tx) => {
				await tx
					.update(members)
					.set({ memberStatus: active ? "active" : "inactive" })
					.where(eq(members.id, memberId));

				await tx
					.update(users)
					.set({ active: !active })
					.where(eq(users.id, user.id));

				await logActivity({
					data: {
						action: "toggle active",
						description: `${active ? "Activated" : "Deactivated"} member ${user.name}`,
						userId: loggedUserId,
					},
				});
			});

			return memberId;
		},
	);

export const deleteMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(z.string().min(1, "Member id is required"))
	.handler(
		async ({
			data: memberId,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			await requirePermission("members:delete");

			try {
				const member = await getMember({ data: memberId });
				if (!member) {
					return failure({
						type: "NotFoundError",
						message: "Member not found",
					});
				}

				await db.transaction(async (tx) => {
					await tx
						.update(members)
						.set({ deletedAt: new Date() })
						.where(and(eq(members.id, memberId), isNull(members.deletedAt)));

					await tx
						.update(users)
						.set({ active: false })
						.where(eq(users.memberId, memberId));

					const memberProfile = await tx.query.memberAccessProfiles.findFirst({
						where: eq(memberAccessProfiles.memberId, memberId),
					});

					if (memberProfile) {
						await tx
							.update(memberAccessProfiles)
							.set({
								desiredAccessEnabled: false,
								accessControlStatus: "pending_sync",
								currentAreaId: memberProfile.unauthorizedAreaId,
								updatedAt: new Date(),
							})
							.where(eq(memberAccessProfiles.memberId, memberId));

						await tx.insert(accessControlSyncJobs).values({
							memberId,
							action: "DISABLE_ACCESS",
							status: "pending",
							payload: {
								biotimeEmployeeId: memberProfile.biotimeEmployeeId,
								areaIds: [memberProfile.unauthorizedAreaId],
								reason: "member_deleted",
							},
							idempotencyKey: `DISABLE_ACCESS:${memberId}:${Date.now()}`,
						});
					}

					await logActivity({
						data: {
							action: "delete member",
							description: `Deleted member ${member.firstName} ${member.lastName}`,
							userId: loggedUserId,
						},
					});
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete member",
				});
			}
		},
	);

const validateMemberUniqueness = async ({
	contact,
	idNumber,
	memberId,
}: {
	contact: string;
	idNumber?: string | null;
	memberId?: string;
}) => {
	if (
		await checkColumnExists({
			data: { column: "contact", value: contact, memberId },
		})
	) {
		throw new ConflictError("Contact");
	}

	if (idNumber) {
		if (
			await checkColumnExists({
				data: { column: "idNo", value: idNumber, memberId },
			})
		) {
			throw new ConflictError("ID Number");
		}
	}
};

const mapMemberData = (data: MemberFormSchema) => {
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
};
