import {
	createFileRoute,
	Link,
	stripSearchParams,
} from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { Button } from "@/components/ui/button";
import { Users2Icon } from "@/components/ui/icons";
import { Search } from "@/components/ui/search";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { BILL_STATUS } from "@/drizzle/schema";
import { BillTable } from "@/features/bills/components/bill-table";
import { billQueries } from "@/features/bills/services/queries";
import { billValidateSearch } from "@/features/bills/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { requirePermission } from "@/lib/permissions/permissions";
import { toTitleCase } from "@/lib/utils";

const defaultValue = {
	status: "all" as const,
	q: "",
};

export const Route = createFileRoute("/app/bills/")({
	beforeLoad: async () => {
		await requirePermission("bills:view");
	},
	component: RouteComponent,
	validateSearch: billValidateSearch,
	head: () => ({
		meta: [{ title: "Bills / Prime Age Beauty & Fitness Centre" }],
	}),
	loader: async ({ context: { queryClient } }) =>
		await queryClient.ensureQueryData(billQueries.list()),
	pendingComponent: () => (
		<BasePageLoadingSkeleton pageTitle="Bills" pageDescription="Manage bills" />
	),
	search: {
		middlewares: [stripSearchParams(defaultValue)],
	},
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageDescription="Manage bills"
			createPermissions={["bills:create"]}
			hasNewButtonLink
			pageTitle="Bills"
			buttonText="Create Bill"
			filterClassName="md:justify-end"
			newButtonLinkPath="/app/bills/new"
			customFilters={<Filters />}
			extraActionButtons={
				<Button size="lg" variant="outline" asChild>
					<Link to="/app/suppliers">
						<Users2Icon />
						Manage Suppliers
					</Link>
				</Button>
			}
		>
			<BillTable />
		</BasePageComponent>
	);
}

function Filters() {
	const { filters, setFilters } = useFilters(Route.id);
	return (
		<div className="flex flex-col md:flex-row gap-4">
			<Search
				placeholder="Search Bills..."
				onHandleSearch={(val) => {
					setFilters({ q: val });
				}}
				defaultValue={filters?.q}
			/>
			<Select
				onValueChange={(e) => setFilters({ status: e })}
				value={filters?.status}
			>
				<SelectTrigger className="w-full md:max-w-md">
					<SelectValue placeholder="Payment Status" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All</SelectItem>
					{BILL_STATUS.map((status) => (
						<SelectItem key={status} value={status}>
							{toTitleCase(status)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
