import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { BasePageComponent, BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { EnquiryFilters } from "@/features/enquiries/components/filters";
import { EnquiryTable } from "@/features/enquiries/components/enquiry-table";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import { enquiryValidateSearch } from "@/features/enquiries/services/schemas";
import { assertCan } from "@/lib/permissions/can";

const defaultValues = {
	q: "",
	status: "all" as const,
	source: "all" as const,
	assignedEmployeeId: "all",
	followUp: "all" as const,
};

export const Route = createFileRoute("/app/enquiries/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "enquiries:view");
	},
	validateSearch: enquiryValidateSearch,
	loaderDeps: ({ search }) => search,
	search: {
		middlewares: [stripSearchParams(defaultValues)],
	},
	head: () => ({
		meta: [{ title: "Enquiries / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageTitle="Enquiries"
			pageDescription="Track and follow up enquiries"
		/>
	),
	loader: async ({ context, deps }) => {
		const [employees] = await Promise.all([
			context.queryClient.ensureQueryData(enquiryQueries.assignableEmployees()),
			context.queryClient.ensureQueryData(enquiryQueries.list(deps)),
		]);
		return { employees };
	},
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Enquiries"
			pageDescription="Track and follow up people asking about membership"
			buttonText="Log Enquiry"
			hasNewButtonLink={true}
			newButtonLinkPath="/app/enquiries/new"
			filterClassName="md:justify-end"
			customFilters={<EnquiryFilters />}
			createPermissions={["enquiries:create"]}
		>
			<EnquiryTable />
		</BasePageComponent>
	);
}
