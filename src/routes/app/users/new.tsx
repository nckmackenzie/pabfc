import { createFileRoute } from "@tanstack/react-router";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { FormLoader } from "@/components/ui/loaders";
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
		<PageWrapperWithBackLink
			wrapperSize="sm"
			backPath="/app/users"
			buttonText="Back to Users"
		>
			<UserForm roles={roles} />
		</PageWrapperWithBackLink>
	);
}
