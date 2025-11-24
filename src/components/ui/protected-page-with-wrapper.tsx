import { EditPageWrapper } from '@/components/ui/edit-page-wrapper'
import { ProtectedPage } from '@/components/ui/protected-page'
import { Wrapper } from '@/components/ui/wrapper'
import type { Permission } from '@/lib/permissions/constants'
import type { Route } from '@/types/index.types'

type BaseProps = {
  children: React.ReactNode
  permissions: Array<Permission>
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'full'
}

type WithBackLinkProps = BaseProps & {
  hasBackLink: true
  backPath: Route
  buttonText: string
}

type WithoutBackLinkProps = BaseProps & {
  hasBackLink?: false
  backPath?: never
  buttonText?: never
}

type Props = WithBackLinkProps | WithoutBackLinkProps

export function ProtectedPageWithWrapper({
  permissions,
  size = 'full',
  backPath,
  buttonText,
  hasBackLink,
  children,
}: Props) {
  return (
    <ProtectedPage permissions={permissions}>
      {hasBackLink ? (
        <EditPageWrapper backPath={backPath} buttonText={buttonText}>
          <Wrapper size={size}>{children}</Wrapper>
        </EditPageWrapper>
      ) : (
        <Wrapper size={size}>{children}</Wrapper>
      )}
    </ProtectedPage>
  )
}
