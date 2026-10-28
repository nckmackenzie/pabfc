import { assertCan } from "@/lib/permissions/can";
import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ClipboardCheckIcon } from "@/components/ui/icons";
import { TicketIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/links";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ProtectedPage } from "@/components/ui/protected-page";
import { ReceiptsTable } from "@/features/receipts/components/payment-table";
import { paymentsSearchValidateSchema } from "@/features/receipts/services/schemas";
import { useFilters } from "@/hooks/use-filters";

export const Route = createFileRoute("/app/receipts/")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "receipts:view");
	},
	component: RouteComponent,
	validateSearch: paymentsSearchValidateSchema,
	head: () => ({
		meta: [{ title: "Receipts / Prime Age Beauty & Fitness Club" }],
	}),
});

function RouteComponent() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<ProtectedPage permissions={["receipts:view"]}>
			<BasePageComponent
				pageTitle="Membership Receipts"
				pageDescription="View and manage membership receipts"
				hasNewButtonLink
				newButtonLinkPath="/app/receipts/new"
				createPermissions={["receipts:create"]}
				defaultSearchValue={filters.q}
				onSearch={(val) => setFilters({ q: val })}
				buttonText="Add Receipt"
				extraActionButtons={
					<>
						<PermissionGate permissions={["receipts:guest-pass"]}>
							<ButtonLink
								variant="outline"
								path="/app/receipts/guest-pass/new"
								icon={<TicketIcon />}
							>
								Issue Guest Pass
							</ButtonLink>
						</PermissionGate>
						<PermissionGate
							permissions={["receipts:complimentary-request", "receipts:complimentary-approve"]}
						>
							<ButtonLink
								variant="outline"
								path="/app/receipts/complimentary"
								icon={<ClipboardCheckIcon />}
							>
								Complimentary Memberships
							</ButtonLink>
						</PermissionGate>
					</>
				}
			>
				<ReceiptsTable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
