import { createFileRoute, notFound } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { FormLoader } from "@/components/ui/loaders";
import { Wrapper } from "@/components/ui/wrapper";
import { UserForm } from "@/features/users/components/user-form";
import { rolesQueries, usersQueries } from "@/features/users/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/users/$userId/edit")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Edit User / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context, params: { userId } }) => {
		const [user, roles] = await Promise.all([
			context.queryClient.ensureQueryData(usersQueries.detail(userId)),
			context.queryClient.ensureQueryData(rolesQueries.active()),
		]);

		if (!user) {
			throw notFound();
		}

		return { user, roles };
	},
	pendingComponent: () => <FormLoader />,
});

function RouteComponent() {
	const { user, roles } = Route.useLoaderData();
	return (
		<div className="space-y-8">
			<BackLink size="sm" variant="outline" href="/app/users">
				Back to Users
			</BackLink>
			<Wrapper size="sm">
				<UserForm
					user={{
						...user,
						name: toTitleCase(user.name),
						roleIds: user.userRoles.map((role) => role.role.id),
					}}
					roles={roles}
				/>
			</Wrapper>
		</div>
	);
}
