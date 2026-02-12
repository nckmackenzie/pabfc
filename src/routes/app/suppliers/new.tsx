import { createFileRoute } from "@tanstack/react-router";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { VendorForm } from "@/features/bills/components/vendor-form";

export const Route = createFileRoute("/app/suppliers/new")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Create Supplier / Prime Age Beauty & Fitness Centre" }],
	}),
	staticData: {
		breadcrumb: "Create Supplier",
	},
});

function RouteComponent() {
	return (
		<PageWrapperWithBackLink
			backPath="/app/suppliers"
			buttonText="Back to Suppliers"
			wrapperSize="lg"
		>
			<VendorForm />
		</PageWrapperWithBackLink>
	);
}
