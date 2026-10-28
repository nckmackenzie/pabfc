import { assertCan } from "@/lib/permissions/can";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { BasePageComponent, BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { MemberFilters } from "@/features/members/components/filters";
import { MemberTable } from "@/features/members/components/member-table";
import { memberQueries } from "@/features/members/services/queries";
import { memberValidateSearch } from "@/features/members/services/schemas";
import { planQueries } from "@/features/plans/services/queries";

const defaultValues = {
	q: "",
	status: "all" as const,
	plan: "all",
};

export const Route = createFileRoute("/app/members/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "members:view");
	},
	validateSearch: memberValidateSearch,
	loaderDeps: ({ search }) => search,
	search: {
		middlewares: [stripSearchParams(defaultValues)],
	},
	head: () => ({
		meta: [{ title: "Members / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => (
		<BasePageLoadingSkeleton pageTitle="Members" pageDescription="View and manage members" />
	),
	loader: async ({ context, deps }) => {
		const [activePlans] = await Promise.all([
			context.queryClient.ensureQueryData(planQueries.active()),
			context.queryClient.ensureQueryData(memberQueries.list(deps)),
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
