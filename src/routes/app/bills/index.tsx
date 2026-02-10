import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { Button } from "@/components/ui/button";
import { Users2Icon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/bills/")({
	beforeLoad: async () => {
		await requirePermission("bills:view");
	},
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Bills / Prime Age Beauty & Fitness Centre" }],
	}),
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageDescription="Manage bills"
			createPermissions={["bills:create"]}
			hasNewButtonLink
			pageTitle="Bills"
			buttonText="Create Bill"
			newButtonLinkPath="/app/bills/new"
			searchPlaceholder="Search Bills..."
			onSearch={(value) => {
				console.log(value);
			}}
			extraActionButtons={
				<Button size="lg" variant="outline">
					<Users2Icon />
					Manage Suppliers
				</Button>
			}
		>
			<span>Hello "/app/bills/"!</span>
		</BasePageComponent>
	);
}
