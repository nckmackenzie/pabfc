import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";
import { ResetPasswordForm } from "@/features/users/components/reset-password-form";
import { usersQueries } from "@/features/users/services/queries";
import { generateRandomId, toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/users/$userId/reset")({
	head: () => ({
		meta: [{ title: "Reset Password - Pharma Solutions" }],
	}),
	loader: async ({ context, params: { userId } }) => {
		const user = await context.queryClient.ensureQueryData(
			usersQueries.detail(userId),
		);
		if (!user) {
			throw notFound();
		}
		return { user };
	},
	staticData: {
		breadcrumb: (match) =>
			`Reset Password for ${toTitleCase(match.loaderData.user.name)}`,
	},
	component: RouteComponent,
	pendingComponent: () => (
		<Wrapper size="xs">
			<PageHeader
				title="Reset Password"
				description="Reset the password for user"
			/>
			<div className="space-y-4">
				{Array.from({ length: 2 }).map((_, index) => (
					<div
						key={generateRandomId(`skeleton-${index}`)}
						className="flex gap-2"
					>
						<Skeleton className="size-4 rounded-full" />
						<Skeleton className="h-4 grow" />
					</div>
				))}
				<Skeleton className="h-10 w-56 rounded" />
			</div>
		</Wrapper>
	),
});

function RouteComponent() {
	const { user } = Route.useLoaderData();
	return (
		<PageWrapperWithBackLink
			wrapperSize="xs"
			backPath="/app/users"
			buttonText="Back to Users"
		>
			<PageHeader
				title="Reset Password"
				description={`Reset the password for user ${toTitleCase(user.name)}`}
			/>
			<ResetPasswordForm />
		</PageWrapperWithBackLink>
	);
}
