import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { accounts, members, users } from "@/drizzle/schema";
import {
	type MemberFormSchema,
	memberFormSchema,
} from "@/features/members/services/schemas";
import { hashPassword } from "@/features/users/services/users.api";
import { ConflictError } from "@/lib/error-handling/app-error";
import { permissionsMiddleware } from "@/middlewares/permission-middleware";
import { logActivity } from "@/services/activity-logger";
import { checkColumnExists, getMemberNo } from "./members.queries.api";

export const createMember = createServerFn({ method: "POST" })
	.middleware([permissionsMiddleware(["members:create"])])
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

				const [{ id: userId }] = await tx
					.insert(users)
					.values({
						name: `${data.firstName} ${data.lastName}`,
						contact: data.contact,
						memberId: id,
						role: "member",
						username: data.contact,
						email: data.email,
					})
					.returning({ id: users.id });

				const hashedPassword = await hashPassword("password");
				// TODO: send password to member
				await tx.insert(accounts).values({
					userId,
					providerId: "credential",
					accountId: userId,
					password: hashedPassword,
				});

				await logActivity({
					data: {
						action: "create member",
						description: `Created member ${data.firstName} ${data.lastName}`,
						userId: loggedUserId,
					},
				});

				return id;
			});

			return memberId;
		},
	);

export const updateMember = createServerFn({ method: "POST" })
	.middleware([permissionsMiddleware(["members:update"])])
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
