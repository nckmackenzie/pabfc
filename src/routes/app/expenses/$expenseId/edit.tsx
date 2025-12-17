import { createFileRoute, notFound } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { expenseQueries } from "@/features/expenses/services/queries";

export const Route = createFileRoute("/app/expenses/$expenseId/edit")({
	head: () => ({
		meta: [{ title: "Edit Expense / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	loader: async ({ params: { expenseId }, context: { queryClient } }) => {
		const expense = await queryClient.ensureQueryData(
			expenseQueries.detail(expenseId),
		);
		if (!expense) {
			throw notFound();
		}
		return expense;
	},
	pendingComponent: FormLoader,
});

function RouteComponent() {
	const expense = Route.useLoaderData();
	return (
		<ProtectedPageWithWrapper
			hasBackLink
			backPath="/app/expenses"
			buttonText="Expenses List"
			permissions={["expenses:update"]}
		>
			<ExpenseForm expenseNo={expense.expenseNo} expense={expense} />
		</ProtectedPageWithWrapper>
	);
}
