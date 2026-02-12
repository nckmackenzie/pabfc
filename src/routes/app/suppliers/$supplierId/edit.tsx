import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { FormLoader } from "@/components/ui/loaders";
import { VendorForm } from "@/features/bills/components/vendor-form";
import { supplierQueries } from "@/features/bills/services/queries";
import { toTitleCase } from "@/lib/utils";

export const Route = createFileRoute("/app/suppliers/$supplierId/edit")({
	component: RouteComponent,
	loader: async ({ context: { queryClient }, params }) =>
		await queryClient.ensureQueryData(
			supplierQueries.detail(params.supplierId),
		),
	pendingComponent: FormLoader,
	head: () => ({
		meta: [{ title: `Edit Supplier / Prime Age Beauty & Fitness Centre` }],
	}),
	staticData: {
		breadcrumb: (match) =>
			`Edit Supplier ${toTitleCase(match.loaderData.name.toLowerCase())}`,
	},
});

function RouteComponent() {
	const loaderVendor = Route.useLoaderData();
	const { supplierId } = Route.useParams();
	const { data: vendor } = useQuery(supplierQueries.detail(supplierId));
	return (
		<PageWrapperWithBackLink
			backPath="/app/suppliers"
			buttonText="Back to Suppliers"
			wrapperSize="lg"
		>
			<VendorForm vendor={vendor || loaderVendor} fromModal={false} />
		</PageWrapperWithBackLink>
	);
}
