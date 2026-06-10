import { createServerFn } from "@tanstack/react-start";
import {
	and,
	asc,
	desc,
	eq,
	ilike,
	isNull,
	ne,
	not,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/drizzle/db";
import {
	accounts,
	loginAttempts,
	sessions,
	userRoles,
	users,
} from "@/drizzle/schema";
import {
	resetPasswordFormSchema,
	type UserSchema,
	userSchema,
} from "@/features/users/services/schema";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password";
import { NotFoundError } from "@/lib/error-handling/app-error";
import { inngest } from "@/lib/inngest/client";
import { failure, success } from "@/lib/result";
import { searchValidateSchema } from "@/lib/schema-rules";
import { adminMiddleware, authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

const createUser = async ({
	data,
	loggedUserId,
}: {
	data: UserSchema;
	loggedUserId: string;
}) => {
	try {
		if (await getUserByContact({ data: { contact: data.contact } })) {
			return failure({
				type: "ConflictError",
				message: "Contact already exists",
			});
		}

		const { userId, temporaryPassword } = await db.transaction(async (tx) => {
			const [{ id }] = await tx
				.insert(users)
				.values({
					name: data.name.toLowerCase(),
					username: data.contact,
					contact: data.contact,
					role: data.role,
					active: true,
				})
				.returning({ id: users.id });

			const temporaryPassword = generateTemporaryPassword();
			await tx.insert(accounts).values({
				id: nanoid(),
				accountId: id,
				providerId: "credential",
				userId: id,
				password: await hashPassword(temporaryPassword),
			});

			if (data.role !== "admin" && data.roleIds?.length) {
				await tx
					.insert(userRoles)
					.values(data.roleIds.map((roleId) => ({ userId: id, roleId })));
			}

			return { userId: id, temporaryPassword };
		});

		await logActivity({
			data: {
				userId: loggedUserId,
				action: "create user",
				description: `Created new user ${data.name}`,
			},
		});

		await inngest.send({
			name: "app/users.send.temporary.password",
			data: {
				password: temporaryPassword,
				userId,
			},
		});

		return success(undefined);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to create user",
		});
	}
};

const updateUser = async ({
	data,
	loggedUserId,
}: {
	data: UserSchema;
	loggedUserId: string;
}) => {
	try {
		if (
			await getUserByContact({
				data: { contact: data.contact, userId: data.id },
			})
		) {
			return failure({
				type: "ConflictError",
				message: "Contact already exists",
			});
		}

		const userId = data.id as string;
		await db.transaction(async (tx) => {
			await tx
				.update(users)
				.set({
					name: data.name.toLowerCase(),
					username: data.contact,
					contact: data.contact,
					role: data.role,
					active: data.active,
				})
				.where(eq(users.id, userId));

			await tx.delete(userRoles).where(eq(userRoles.userId, userId));

			if (data.role !== "admin" && data.roleIds?.length) {
				await tx
					.insert(userRoles)
					.values(data.roleIds.map((roleId) => ({ userId, roleId })));
			}
		});

		await logActivity({
			data: {
				userId: loggedUserId,
				action: "update user",
				description: `Updated user ${data.name} details`,
			},
		});

		return success(undefined);
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to update user",
		});
	}
};

export const getUserByContact = createServerFn()
	.validator((data: { contact: string; userId?: string }) => data)
	.handler(async ({ data: { contact, userId } }) => {
		const user = await db.query.users.findFirst({
			columns: {
				deleted_at: false,
				updatedAt: false,
				emailVerified: false,
			},
			where: and(
				eq(users.contact, contact),
				eq(users.active, true),
				userId ? ne(users.id, userId) : undefined,
			),
		});
		return user;
	});

export const getUsers = createServerFn()
	.middleware([adminMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		const filters: Array<SQL> = [];
		if (q) {
			const query = q.trim().toLowerCase();
			const searchFilters = or(
				ilike(users.name, `%${query}%`),
				ilike(users.contact, `%${query}%`),
				ilike(sql`CAST(${users.role} AS TEXT)`, `%${query}%`),
			);
			if (searchFilters) {
				filters.push(searchFilters);
			}
		}

		return await db.query.users
			.findMany({
				columns: {
					deleted_at: false,
					updatedAt: false,
					displayUsername: false,
					emailVerified: false,
				},
				with: {
					loginAttempts: {
						columns: { attemptedAt: true },
						limit: 1,
						where: eq(loginAttempts.success, true),
						orderBy: [desc(loginAttempts.attemptedAt)],
					},
				},
				where: and(
					isNull(users.deleted_at),
					not(eq(users.role, "member")),
					...filters,
				),
				orderBy: [asc(sql`lower(${users.name})`)],
			})
			.then((users) =>
				users.map((user) => ({
					...user,
					lastSignedInAt: user.loginAttempts[0]?.attemptedAt || null,
				})),
			);
	});

export const upsertUser = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(userSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			if (data.id) {
				return updateUser({ data, loggedUserId });
			}
			return createUser({ data, loggedUserId });
		},
	);

export const getUserWithRole = createServerFn()
	.middleware([authMiddleware])
	.validator((data: { userId: string }) => data)
	.handler(async ({ data }) => {
		return db.query.users.findFirst({
			columns: {
				id: true,
				name: true,
				email: true,
				active: true,
				role: true,
				contact: true,
			},
			with: {
				userRoles: {
					columns: {},
					with: { role: { columns: { id: true, name: true } } },
				},
			},
			where: eq(users.id, data.userId),
		});
	});

export const deleteUser = createServerFn()
	.middleware([adminMiddleware])
	.validator((userId: string) => userId)
	.handler(
		async ({
			data: userId,
			context: {
				user: { id },
			},
		}) => {
			try {
				if (!(await getUserWithRole({ data: { userId } }))) {
					return failure({ type: "NotFoundError", message: "User not found" });
				}

				await db.transaction(async (tx) => {
					await tx.delete(userRoles).where(eq(userRoles.userId, userId));
					await tx.delete(accounts).where(eq(accounts.userId, userId));
					await tx.delete(sessions).where(eq(sessions.userId, userId));
					await tx.delete(users).where(eq(users.id, userId));
				});

				await logActivity({
					data: {
						userId: id,
						action: "delete user",
						description: `Deleted user ${userId}`,
					},
				});

				return success(undefined);
			} catch (error) {
				console.error(error);
				return failure({
					type: "ApplicationError",
					message: "Failed to delete user",
				});
			}
		},
	);

export const resetPassword = createServerFn()
	.middleware([adminMiddleware])
	.validator(resetPasswordFormSchema)
	.handler(async ({ data }) => {
		const { userId, resetMethod, password } = data;

		const user = await getUserWithRole({ data: { userId } });
		if (!user) {
			throw new NotFoundError("User");
		}

		let newPassword: string;
		if (resetMethod === "automatic") {
			newPassword = generateTemporaryPassword();
		} else {
			newPassword = password as string;
		}

		const hashedPassword = await hashPassword(newPassword);

		await db
			.update(accounts)
			.set({ password: hashedPassword })
			.where(
				and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
			);

		return newPassword;
	});

export type UserWithLoginAttempts = Awaited<
	ReturnType<typeof getUsers>
>[number];
