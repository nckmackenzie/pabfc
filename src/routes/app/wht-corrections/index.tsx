import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent, BasePageLoadingSkeleton } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { CorrectionsTable } from "@/features/wht-corrections/components/corrections-table";
import { useFilters } from "@/hooks/use-filters";
import { searchValidateSchema } from "@/lib/schema-rules";

export const Route = createFileRoute("/app/wht-corrections/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "wht-corrections:view");
	},
	component: RouteComponent,
	validateSearch: searchValidateSchema,
	head: () => ({
		meta: [{ title: "WHT Corrections / Prime Age Beauty & Fitness Club" }],
	}),
	pendingComponent: BasePageLoadingSkeleton,
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["wht-corrections:view"]}>
			<BasePageComponent
				pageTitle="WHT Corrections"
				pageDescription="Missed withholding tax catch-ups against already-posted bills"
				hasNewButtonLink
				newButtonLinkPath="/app/wht-corrections/new"
				createPermissions={["wht-corrections:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Correction"
			>
				<CorrectionsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
