import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
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
import { ConflictError, NotFoundError } from "@/lib/error-handling/app-error";
import { searchValidateSchema } from "@/lib/schema-rules";
import { adminMiddleware, authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";

export function generateTemporaryPassword(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
	let password = "";
	for (let i = 0; i < 8; i++) {
		password += chars[Math.floor(Math.random() * chars.length)];
	}
	return password;
}

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) ?? 12);
}

export const getUserByContact = createServerFn()
	.inputValidator((data: { contact: string; userId?: string }) => data)
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
	.inputValidator(searchValidateSchema)
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

export const createUser = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator(userSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: loggedUserId },
			},
		}) => {
			if (await getUserByContact({ data: { contact: data.contact } })) {
				throw new ConflictError("Contact");
			}

			const userId = await db.transaction(async (tx) => {
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

				await logActivity({
					data: {
						userId: loggedUserId,
						action: "create user",
						description: `Created new user ${data.name}`,
					},
				});

				return id;
			});

			return userId;
		},
	);

export const getUserWithRole = createServerFn()
	.middleware([authMiddleware])
	.inputValidator((data: { userId: string }) => data)
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

export const updateUser = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((values: { userId: string; data: UserSchema }) => values)
	.handler(
		async ({
			data: { userId, data },
			context: {
				user: { id },
			},
		}) => {
			if (await getUserByContact({ data: { contact: data.contact, userId } })) {
				throw new ConflictError("Contact");
			}

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
					userId: id,
					action: "update user",
					description: `Updated user ${data.name} details`,
				},
			});

			return userId;
		},
	);

export const deleteUser = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((userId: string) => userId)
	.handler(
		async ({
			data: userId,
			context: {
				user: { id },
			},
		}) => {
			if (!(await getUserWithRole({ data: { userId } }))) {
				throw new NotFoundError("User");
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
		},
	);

export const resetPassword = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator(resetPasswordFormSchema)
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
