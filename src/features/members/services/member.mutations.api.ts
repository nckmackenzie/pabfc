import { createServerFn } from "@tanstack/react-start";
import { db } from "@/drizzle/db";
import { accounts, members, users } from "@/drizzle/schema";
import { memberFormSchema } from "@/features/members/services/schemas";
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

			if (
				await checkColumnExists({ data: { column: "contact", value: contact } })
			) {
				throw new ConflictError("Contact");
			}

			if (idNumber) {
				if (
					await checkColumnExists({ data: { column: "idNo", value: idNumber } })
				) {
					throw new ConflictError("ID Number");
				}
			}

			const memberNo = await getMemberNo();

			const memberId = await db.transaction(async (tx) => {
				const [{ id }] = await tx
					.insert(members)
					.values({
						firstName,
						lastName,
						dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
						gender: gender ?? undefined,
						email: email ?? undefined,
						contact,
						idType: idType ?? undefined,
						idNumber: !idType ? null : idNumber,
						memberStatus,
						memberNo,
						emergencyContactName: emergencyContactName ?? undefined,
						emergencyContactNo: emergencyContactNo ?? undefined,
						emergencyContactRelationship:
							emergencyContactRelationship ?? undefined,
						notes: notes ?? undefined,
					})
					.returning({ id: members.id });

				const [{ id: userId }] = await tx
					.insert(users)
					.values({
						name: `${firstName} ${lastName}`,
						contact,
						memberId: id,
						role: "member",
						username: contact,
						email,
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
						description: `Created member ${firstName} ${lastName}`,
						userId: loggedUserId,
					},
				});

				return id;
			});

			return memberId;
		},
	);
