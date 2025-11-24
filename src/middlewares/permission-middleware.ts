import { createMiddleware } from '@tanstack/react-start'
import { AuthorizationError } from '@/lib/error-handling/app-error'
import type { Permission } from '@/lib/permissions/constants'
import { hasAnyPermission } from '@/lib/permissions/permissions-service'
import { authMiddleware } from '@/middlewares/auth-middleware'

export const permissionsMiddleware = (permissions: Array<Permission>) =>
  createMiddleware()
    .middleware([authMiddleware])
    .server(async ({ next }) => {
      if (!(await hasAnyPermission({ data: permissions }))) {
        throw new AuthorizationError('You do not have the required permissions')
      }
      return next()
    })
