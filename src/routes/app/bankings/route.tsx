import {
	createFileRoute,
	Link,
	linkOptions,
	Outlet,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { Skeleton } from "@/components/ui/skeleton";
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
			exact: false,
		},
	},
	{
		to: "/app/bankings/reconcilliation",
		label: "Reconciliation",
		activeOptions: {
			exact: false,
		},
	},
]);

export const Route = createFileRoute("/app/bankings")({
	component: RouteComponent,
	beforeLoad: async () => {
		const banks = await getBanks();
		return { banks };
	},
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
	pendingComponent: () => (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-10 w-40" />
				<Skeleton className="h-4 w-md" />
			</div>
			<div className="grid md:grid-cols-3 gap-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		</div>
	),
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
