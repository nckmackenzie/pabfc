import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { FinancialYearForm } from "@/features/financial-years/components/financial-year-form";
import { financialYearQueries } from "@/features/financial-years/services/queries";
import { requirePermission } from "@/lib/permissions/permissions";

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
		if (!financialYear) {
			throw notFound();
		}
		return { financialYear };
	},
	staticData: {
		breadcrumb: (match) => `Edit ${match.loaderData.financialYear.name}`,
	},
});

function RouteComponent() {
	const { financialYear } = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/financial-years"
			buttonText="Financial Years List"
			permissions={["financial-years:update"]}
			size="sm"
		>
			<FinancialYearForm financialYear={financialYear} />
		</ProtectedPageWithWrapper>
	);
}
