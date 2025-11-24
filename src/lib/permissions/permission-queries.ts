import { eq } from 'drizzle-orm'
import { db } from '@/drizzle/db'
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '@/drizzle/schema'
import type { Permission } from '@/lib/permissions/constants'

export type UserPermissions = {
  userId: string
  permissions: Array<string>
  roles: Array<string>
}

export async function getUserPermissionsByUserId(
  userId: string,
): Promise<UserPermissions> {
  const result = await db
    .select({
      userId: users.id,
      permissionName: permissions.key,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(users.id, userId))

  const permissionSet = new Set<string>()
  const roleSet = new Set<string>()

  result.forEach((row) => {
    permissionSet.add(row.permissionName)
    roleSet.add(row.roleName)
  })

  return {
    userId,
    permissions: Array.from(permissionSet),
    roles: Array.from(roleSet),
  }
}

export async function userHasPermission(
  userId: string,
  userType: string,
  permission: Permission,
): Promise<boolean> {
  if (userType === 'admin') {
    return true
  }

  const userPermissions = await getUserPermissionsByUserId(userId)
  return userPermissions.permissions.includes(permission)
}

export async function userHasAnyPermission(
  userId: string,
  userType: string,
  permissionList: Array<Permission>,
): Promise<boolean> {
  if (userType === 'admin') {
    return true
  }

  const userPermissions = await getUserPermissionsByUserId(userId)
  return permissionList.some((permission) =>
    userPermissions.permissions.includes(permission),
  )
}

export async function userHasRole(
  userId: string,
  userType: string,
  roleName: string,
): Promise<boolean> {
  if (userType === 'admin') {
    return true
  }

  const userPermissions = await getUserPermissionsByUserId(userId)
  return userPermissions.roles.includes(roleName)
}
