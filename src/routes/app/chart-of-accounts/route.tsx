import { AlertErrorComponent } from '@/components/ui/error-component'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/app/chart-of-accounts')({
  component: RouteComponent,
  errorComponent: ({error}) => <AlertErrorComponent message={error.message} />
})

function RouteComponent() {
  return <Outlet />
}
