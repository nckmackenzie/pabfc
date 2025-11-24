import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/member/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/member/dashboard"!</div>
}
