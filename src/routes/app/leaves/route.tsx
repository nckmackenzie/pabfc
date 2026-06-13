import { AlertErrorComponent } from '@/components/ui/error-component'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/app/leaves')({
 component: Outlet,
	staticData: {
		breadcrumb: "Leave Management",
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} title="Error" />
	),
})

