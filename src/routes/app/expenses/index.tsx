import { createFileRoute } from "@tanstack/react-router";
import {
	BasePageComponent,
	BasePageLoadingSkeleton,
} from "@/components/ui/base-page";
import { ProtectedPage } from "@/components/ui/protected-page";
import { ExpenseDatatable } from "@/features/expenses/components/expense-datatable";
import { ExpenseFilters } from "@/features/expenses/components/filters";
import { expenseValidateSearch } from "@/features/expenses/services/schemas";

export const Route = createFileRoute("/app/expenses/")({
	component: RouteComponent,
	validateSearch: expenseValidateSearch,
	head: () => ({
		meta: [{ title: "Expenses / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: () => (
		<BasePageLoadingSkeleton
			pageDescription="Manage your expenses"
			pageTitle="Expenses"
		/>
	),
});

function RouteComponent() {
	return (
		<ProtectedPage permissions={["expenses:view"]}>
			<BasePageComponent
				pageTitle="Expenses"
				pageDescription="Manage your expenses"
				hasNewButtonLink={true}
				newButtonLinkPath={"/app/expenses/new"}
				createPermissions={["expenses:create"]}
				filterClassName="md:justify-end"
				customFilters={<ExpenseFilters />}
			>
				<ExpenseDatatable />
			</BasePageComponent>
		</ProtectedPage>
	);
}
