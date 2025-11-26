import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { Wip } from "@/components/ui/wip";
import { MemberFilters } from "@/features/members/components/filters";
import { memberValidateSearch } from "@/features/members/services/schemas";
import { requirePermission } from "@/lib/permissions/permissions";

const defaultValues = {
	q: "",
	status: "all",
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
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Members"
			pageDescription="View and manage members"
			buttonText="Create new Member"
			hasNewButtonLink={true}
			newButtonLinkPath="/app/members"
			filterClassName="md:justify-end"
			customFilters={<MemberFilters />}
		>
			{/* TODO: HANDLE EMPTY DATA */}
			<Wip displayBackButton={false} transparent />
		</BasePageComponent>
	);
}
