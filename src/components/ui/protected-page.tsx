import { PageLoader } from '@/components/ui/loaders'
import { Unauthorized } from '@/components/ui/unauthorized'
import { usePermissions } from '@/hooks/use-permissions'
import type { Permission } from '@/lib/permissions/constants'

type Props = {
  children: React.ReactNode
  permissions: Array<Permission>
}

export function ProtectedPage({ children, permissions }: Props) {
  const { hasAnyPermission, isLoading } = usePermissions()
  if (isLoading) return <PageLoader loaderMessage='Checking permissions...' />
  if (!hasAnyPermission(permissions)) return <Unauthorized />
  return <>{children}</>
}
