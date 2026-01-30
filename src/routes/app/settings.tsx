import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";
import { accountQueries } from "@/features/coa/services/queries";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { settingsQuery } from "@/features/settings/services/queries";
import { generateRandomId } from "@/lib/utils";

export const Route = createFileRoute("/app/settings")({
	head: () => ({
		meta: [{ title: "Settings / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Settings",
	},
	beforeLoad: async ({ context: { userSession } }) => {
		if (userSession?.user.role !== "admin") {
			throw redirect({ to: "/app/unauthorized" });
		}
	},
	component: RouteComponent,
	pendingComponent: SettingsSkeleton,
	loader: async ({ context: { queryClient } }) => {
		const [settings, accounts] = await Promise.all([
			queryClient.ensureQueryData(settingsQuery()),
			queryClient.ensureQueryData(accountQueries.list({})),
		]);

		return {
			settings,
			accounts: accounts
				.filter(
					(acc) => acc.type === "liability" && acc.isActive && acc.isPosting,
				)
				.map((acc) => ({ id: acc.id, name: acc.name })),
		};
	},
});

function RouteComponent() {
	return (
		<Wrapper size="full">
			<PageHeader
				title="Settings"
				description="Define application settings and preferences"
			/>
			<SettingsForm />
		</Wrapper>
	);
}

export function SettingsSkeleton() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Settings"
				description="Define application settings and preferences"
			/>
			<Skeleton className="h-9 w-full rounded-lg" />

			{/* Form Skeleton */}
			<div className="grid lg:grid-cols-2 gap-4">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={generateRandomId(`skeleton-${i}`)} className="space-y-2">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-4 w-48" />
					</div>
				))}

				{/* Button Skeleton */}
				<div className="col-span-full mt-4">
					<Skeleton className="h-10 w-48" />
				</div>
			</div>
		</div>
	);
}
