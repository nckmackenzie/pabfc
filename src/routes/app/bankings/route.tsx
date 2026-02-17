import {
	createFileRoute,
	Link,
	linkOptions,
	Outlet,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

const bankingSubMenu = linkOptions([
	{
		to: "/app/bankings",
		label: "Bank Postings",
		activeOptions: {
			exact: true,
		},
	},
	{
		to: "/app/bankings",
		label: "Reconciliation",
		activeOptions: {
			exact: true,
		},
	},
	{
		to: "/app/expenses",
		label: "Clearing",
		activeOptions: {
			exact: true,
		},
	},
]);

export const Route = createFileRoute("/app/bankings")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "Bankings",
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
