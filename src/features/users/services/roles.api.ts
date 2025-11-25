import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	permissions,
	rolePermissions,
	roles,
	userRoles,
} from "@/drizzle/schema";
import {
	type RoleFormValues,
	roleFormSchema,
} from "@/features/users/services/schema";
import {
	ConflictError,
	NotFoundError,
	ResourceReferencedError,
} from "@/lib/error-handling/app-error";
import { transformOptions } from "@/lib/utils";
import { adminMiddleware, authMiddleware } from "@/middlewares/auth-middleware";

export const getActiveRoles = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		return transformOptions(
			await db.query.roles.findMany({
				columns: { id: true, name: true },
				orderBy: asc(roles.name),
			}),
		);
	});

export const getRoles = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((query?: string) => query)
	.handler(async ({ data: q }) => {
		return db
			.select({
				id: roles.id,
				name: roles.name,
				description: roles.description,
				usersAssigned: sql<number>`(SELECT COUNT(*) FROM ${userRoles} WHERE ${userRoles.roleId} = ${roles.id})`,
			})
			.from(roles)
			.leftJoin(userRoles, eq(userRoles.roleId, roles.id))
			.where(
				q
					? or(ilike(roles.name, `%${q}%`), ilike(roles.description, `%${q}%`))
					: undefined,
			)
			.groupBy(roles.id, roles.name, roles.description)
			.orderBy(asc(roles.name));
	});

export const getRoleById = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((roleId: string) => roleId)
	.handler(async ({ data: roleId }) => {
		return db.query.roles.findFirst({
			columns: { updatedAt: false, isSystem: false },
			where: eq(roles.id, roleId),
			with: {
				rolePermissions: {
					columns: {},
					with: {
						permission: {
							columns: { createdAt: false },
						},
					},
				},
			},
		});
	});

export const getRoleByName = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((query: { name: string; roleId?: string }) => query)
	.handler(async ({ data }) => {
		const { name, roleId } = data;
		return db.query.roles.findFirst({
			where: and(
				eq(sql`LOWER(${roles.name})`, name.toLowerCase()),
				roleId ? ne(roles.id, roleId) : undefined,
			),
			columns: { id: true },
		});
	});

export const roleIsReferenced = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((roleId: string) => roleId)
	.handler(async ({ data: roleId }) => {
		const userWithRole = await db.query.userRoles.findFirst({
			where: eq(userRoles.roleId, roleId),
			columns: { roleId: true },
		});
		return !!userWithRole;
	});

export const createRole = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator(roleFormSchema)
	.handler(async ({ data }) => {
		const { permissions: permissionValue, name } = data;
		const roleExists = await getRoleByName({ data: { name } });

		if (roleExists) {
			throw new ConflictError("role", name);
		}

		const roleId = await db.transaction(async (tx) => {
			const [{ id }] = await tx
				.insert(roles)
				.values({ name: name.trim().toLowerCase() })
				.returning({ id: roles.id });

			await tx.insert(rolePermissions).values(
				permissionValue.map((permissionId) => ({
					roleId: id,
					permissionId,
				})),
			);
			return id;
		});

		return roleId;
	});

export const updateRole = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((data: { values: RoleFormValues; roleId: string }) => data)
	.handler(async ({ data }) => {
		const {
			roleId,
			values: { name, permissions: permissionValue },
		} = data;

		if (!(await getRoleById({ data: roleId }))) {
			throw new NotFoundError("Role");
		}

		await db.transaction(async (tx) => {
			await tx.update(roles).set({ name }).where(eq(roles.id, roleId));

			await tx
				.delete(rolePermissions)
				.where(eq(rolePermissions.roleId, roleId));

			await tx.insert(rolePermissions).values(
				permissionValue.map((permissionId) => ({
					roleId,
					permissionId,
				})),
			);
		});
	});

export const deleteRole = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((roleId: string) => roleId)
	.handler(async ({ data: roleId }) => {
		if (!(await getRoleById({ data: roleId }))) {
			throw new NotFoundError("Role");
		}

		if (await roleIsReferenced({ data: roleId })) {
			throw new ResourceReferencedError("Role");
		}

		await db.transaction(async (tx) => {
			await tx
				.delete(rolePermissions)
				.where(eq(rolePermissions.roleId, roleId));

			await tx.delete(roles).where(eq(roles.id, roleId));
		});
	});

export const getPermissions = createServerFn()
	.middleware([adminMiddleware])
	.inputValidator((query?: string) => query)
	.handler(async ({ data }) => {
		return db.query.permissions.findMany({
			where: data
				? or(
						ilike(permissions.resource, `%${data}%`),
						ilike(permissions.action, `%${data}%`),
						ilike(permissions.key, `%${data}%`),
						ilike(permissions.description, `%${data}%`),
					)
				: undefined,
			columns: { createdAt: false },
			orderBy: [asc(permissions.resource)],
		});
	});

export type Role = Awaited<ReturnType<typeof getRoles>>[number];
export type Permission = Awaited<ReturnType<typeof getPermissions>>[number];
