import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { Wip } from "@/components/ui/wip";

export const Route = createFileRoute("/app/chart-of-accounts/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Chart of Accounts / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	return (
		<ProtectedPage permissions={["chart-of-accounts:view"]}>
			<BasePageComponent
				pageTitle="Chart of Accounts"
				pageDescription="Manage your chart of accounts"
				hasNewButtonLink={true}
				newButtonLinkPath={"/app/chart-of-accounts/new"}
				createPermissions={["chart-of-accounts:create"]}
			>
				<Wip transparent />
			</BasePageComponent>
		</ProtectedPage>
	);
}
