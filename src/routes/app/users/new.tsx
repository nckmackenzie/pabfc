import { createFileRoute } from "@tanstack/react-router";
import { BackLink } from "@/components/ui/links";
import { FormLoader } from "@/components/ui/loaders";
import { Wrapper } from "@/components/ui/wrapper";
import { UserForm } from "@/features/users/components/user-form";
import { rolesQueries } from "@/features/users/services/queries";

export const Route = createFileRoute("/app/users/new")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New User / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: () => <FormLoader />,
	loader: async ({ context }) => {
		const roles = await context.queryClient.ensureQueryData(
			rolesQueries.active(),
		);
		return { roles };
	},
});

function RouteComponent() {
	const { roles } = Route.useLoaderData();
	return (
		<div className="space-y-8">
			<BackLink size="sm" variant="outline" href="/app/users">
				Back to Users
			</BackLink>
			<Wrapper size="sm">
				<UserForm roles={roles} />
			</Wrapper>
		</div>
	);
}
