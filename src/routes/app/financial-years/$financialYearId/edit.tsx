import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { FinancialYearForm } from "@/features/financial-years/components/financial-year-form";
import { financialYearQueries } from "@/features/financial-years/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute(
	"/app/financial-years/$financialYearId/edit",
)({
	beforeLoad: async () => {
		await requirePermission("financial-years:update");
	},
	component: RouteComponent,
	pendingComponent: FormLoader,
	head: () => ({
		meta: [
			{ title: "Edit Financial Year / Prime Age Beauty & Fitness Center" },
		],
	}),
	loader: async ({ params, context: { queryClient } }) => {
		const financialYear = await queryClient.ensureQueryData(
			financialYearQueries.detail(params.financialYearId),
		);
		return { financialYear };
	},
	staticData: {
		breadcrumb: (match) =>
			`Edit ${toTitleCase(match.loaderData.financialYear.name)}`,
	},
});

function RouteComponent() {
	const { financialYear: loaderData } = Route.useLoaderData();
	const { financialYearId } = Route.useParams();
	const { data: financialYear } = useQuery(
		financialYearQueries.detail(financialYearId),
	);

	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/financial-years"
			buttonText="Financial Years List"
			permissions={["financial-years:update"]}
			size="sm"
		>
			<FinancialYearForm financialYear={financialYear || loaderData} />
		</ProtectedPageWithWrapper>
	);
}
