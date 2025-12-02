import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/plans/$planId/edit')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/plans/$planId/edit"!</div>
}
