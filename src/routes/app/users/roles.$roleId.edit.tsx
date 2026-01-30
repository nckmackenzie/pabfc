import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { FormLoader } from "@/components/ui/loaders";
import { Wrapper } from "@/components/ui/wrapper";
import {
	permissionsQueries,
	rolesQueries,
} from "@/features/users/services/queries";
import { toTitleCase } from "@/lib/utils";

const RoleForm = lazy(() =>
	import("@/features/users/components/role-form").then((m) => ({
		default: m.RoleForm,
	})),
);

export const Route = createFileRoute("/app/users/roles/$roleId/edit")({
	component: RouteComponent,
	loader: async ({ context, params: { roleId } }) => {
		const [role, permissions] = await Promise.all([
			context.queryClient.ensureQueryData(rolesQueries.detail(roleId)),
			context.queryClient.ensureQueryData(permissionsQueries.list()),
		]);

		if (!role) throw notFound();
		return { role, permissions };
	},
	staticData: {
		breadcrumb: (match) => `Edit ${toTitleCase(match.loaderData.role.name)}`,
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `Edit Role - ${toTitleCase(loaderData.role.name)} / Prime Age Beauty & Fitness Center`
					: "Edit Role / Prime Age Beauty & Fitness Center",
			},
		],
	}),
});

function RouteComponent() {
	const { role: loaderRole, permissions } = Route.useLoaderData();
	const { roleId } = Route.useParams();
	const { data: fetchedRole } = useQuery(rolesQueries.detail(roleId));
	const role = fetchedRole ?? loaderRole;
	const formattedRole = {
		id: role.id,
		name: role.name.toUpperCase(),
		description: role.description,
		createdAt: role.createdAt,
		permissions: role.rolePermissions.map(({ permission: { id } }) => id),
	};
	return (
		<PageWrapperWithBackLink
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
				<RoleForm permissions={permissions} role={formattedRole} />
			</Suspense>
		</PageWrapperWithBackLink>
	);
}
