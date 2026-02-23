import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { members, users } from "@/drizzle/schema";
import {
	type MemberFormSchema,
	memberFormSchema,
	memberRevokePortalAccessSchema,
	memberToggleActiveSchema,
} from "@/features/members/services/schemas";
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { inngest } from "@/lib/inngest/client";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import {
	checkColumnExists,
	getMember,
	getMemberNo,
} from "./members.queries.api";

export const createMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(memberFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			await validateMemberUniqueness({
				contact: data.contact,
				idNumber: data.idNumber,
			});

			const memberNo = await getMemberNo();
			const memberData = mapMemberData(data);

			const memberId = await db.transaction(async (tx) => {
				const [{ id }] = await tx
					.insert(members)
					.values({
						...memberData,
						memberNo,
					})
					.returning({ id: members.id });

				await logActivity({
					data: {
						action: "create member",
						description: `Created member ${data.firstName} ${data.lastName}`,
						userId: loggedUserId,
					},
				});

				return id;
			});

			await inngest.send({
				name: "app/members.send.registration.link",
				data: {
					memberId,
				},
			});

			return memberId;
		},
	);

export const updateMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((values: { value: MemberFormSchema; id: string }) => values)
	.handler(
		async ({
			data: { value, id },
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			await validateMemberUniqueness({
				contact: value.contact,
				idNumber: value.idNumber,
				memberId: id,
			});

			const memberData = mapMemberData(value);

			await db.transaction(async (tx) => {
				await tx.update(members).set(memberData).where(eq(members.id, id));

				await tx
					.update(users)
					.set({
						name: `${value.firstName} ${value.lastName}`,
						contact: value.contact,
						email: value.email,
					})
					.where(eq(users.memberId, id));

				await logActivity({
					data: {
						action: "update member",
						description: `Updated member ${value.firstName} ${value.lastName} details`,
						userId: loggedUserId,
					},
				});
			});

			return id;
		},
	);

export const revokePortalAccess = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator(memberRevokePortalAccessSchema)
	.handler(
		async ({
			data: { memberId, revokeReason, banned },
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			if (!(await getMember({ data: memberId }))) {
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
	.inputValidator(z.string().min(1, "member id is required"))
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
	.inputValidator(memberToggleActiveSchema)
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
