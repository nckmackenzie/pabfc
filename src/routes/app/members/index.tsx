import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { MemberFilters } from "@/features/members/components/filters";
import { MemberTable } from "@/features/members/components/member-table";
import { memberValidateSearch } from "@/features/members/services/schemas";
import { planQueries } from "@/features/plans/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

const defaultValues = {
	q: "",
	status: "all" as const,
	plan: "all",
};

export const Route = createFileRoute("/app/members/")({
	beforeLoad: async () => {
		await requirePermission("members:view");
	},
	validateSearch: memberValidateSearch,
	search: {
		middlewares: [stripSearchParams(defaultValues)],
	},
	head: () => ({
		meta: [{ title: "Members / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Members"
			pageDescription="View and manage members"
		/>
	),
	loader: async ({ context }) => {
		const [activePlans] = await Promise.all([
			context.queryClient.ensureQueryData(planQueries.active()),
		]);
		return {
			plans: activePlans,
		};
	},
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Members"
			pageDescription="View and manage members"
			buttonText="Create new Member"
			hasNewButtonLink={true}
			newButtonLinkPath="/app/members/new"
			filterClassName="md:justify-end"
			customFilters={<MemberFilters />}
			createPermissions={["members:create"]}
		>
			<MemberTable />
		</BasePageComponent>
	);
}
