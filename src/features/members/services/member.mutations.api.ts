import { createServerFn } from "@tanstack/react-start";
import { db } from "@/drizzle/db";
import { members } from "@/drizzle/schema";
import { memberFormSchema } from "@/features/members/services/schemas";
import { ConflictError } from "@/lib/error-handling/app-error";
import { permissionsMiddleware } from "@/middlewares/permission-middleware";
import { checkColumnExists } from "./members.queries.api";

export const createMember = createServerFn({ method: "POST" })
	.middleware([permissionsMiddleware(["members:create"])])
	.inputValidator(memberFormSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id },
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
				address,
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

			// const memberId = await db.transaction(async (tx) => {
			// 	const [{ id }] = await tx
			// 		.insert(members)
			// 		.values({
			// 			firstName,
			// 			lastName,
			// 			dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
			// 			gender,
			// 			email,
			// 			contact,
			// 			idType,
			// 			idNumber: !idType ? null : idNumber,
			// 			memberStatus,
			// 			address,
			// 			emergencyContactName,
			// 			emergencyContactNo,
			// 			emergencyContactRelationship,
			// 			notes,
			// 		})
			// 		.returning({ id: members.id });
			// });
		},
	);
