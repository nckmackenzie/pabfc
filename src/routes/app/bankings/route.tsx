import {
	createFileRoute,
	Link,
	linkOptions,
	Outlet,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { getBanks } from "@/features/bankings/services/bankings.api";

const bankingSubMenu = linkOptions([
	{
		to: "/app/bankings/postings",
		label: "Bank Postings",
		activeOptions: {
			exact: false,
		},
	},
	{
		to: "/app/bankings/clear",
		label: "Clearing",
		activeOptions: {
			exact: true,
		},
	},
	{
		to: "/app/bankings/reconcilliation",
		label: "Reconciliation",
		activeOptions: {
			exact: true,
		},
	},
]);

export const Route = createFileRoute("/app/bankings")({
	component: RouteComponent,
	beforeLoad: async () => {
		const banks = await getBanks();
		return { banks };
	},
});

function RouteComponent() {
	return (
		<div className="flex flex-col gap-4">
			<ButtonGroup className="md:self-end">
				{bankingSubMenu.map((item) => (
					<Button key={item.to} variant="bordered" asChild>
						<Link
							activeProps={{
								className: `bg-primary! text-primary-foreground!`,
							}}
							to={item.to}
							activeOptions={item.activeOptions}
						>
							{item.label}
						</Link>
					</Button>
				))}
			</ButtonGroup>
			<Outlet />
		</div>
	);
}
