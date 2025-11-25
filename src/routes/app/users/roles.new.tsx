import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { FormLoader } from "@/components/ui/loaders";
import { Wrapper } from "@/components/ui/wrapper";
import { permissionsQueries } from "@/features/users/services/queries";

const RoleForm = lazy(() =>
	import("@/features/users/components/role-form").then((m) => ({
		default: m.RoleForm,
	})),
);

export const Route = createFileRoute("/app/users/roles/new")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Create Role / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context }) => {
		return await context.queryClient.ensureQueryData(permissionsQueries.list());
	},
	pendingComponent: () => <FormLoader />,
});

function RouteComponent() {
	const permissions = Route.useLoaderData();
	return (
		<PageWrapperWithBackLink
			wrapperSize="full"
			backPath="/app/users/roles"
			buttonText="Back to Roles"
		>
			<Suspense
				fallback={
					<Wrapper size="lg">
						<FormLoader />
					</Wrapper>
				}
			>
				<RoleForm permissions={permissions} />
			</Suspense>
		</PageWrapperWithBackLink>
	);
}
