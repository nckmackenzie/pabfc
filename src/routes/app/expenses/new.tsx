import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { expenseQueries } from "@/features/expenses/services/queries";

export const Route = createFileRoute("/app/expenses/new")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Expense / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: FormLoader,
	loader: async ({ context: { queryClient } }) =>
		await queryClient.ensureQueryData(expenseQueries.expenseNo()),
});

function RouteComponent() {
	const loaderData = Route.useLoaderData();
	const { data: expenseNo } = useQuery(expenseQueries.expenseNo());
	return (
		<ProtectedPageWithWrapper
			permissions={["expenses:create"]}
			hasBackLink
			buttonText="Expenses List"
			backPath="/app/expenses"
		>
			<ExpenseForm expenseNo={expenseNo || loaderData} />
		</ProtectedPageWithWrapper>
	);
}
