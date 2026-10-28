import { assertCan } from "@/lib/permissions/can";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ExpenseForm } from "@/features/expenses/components/expense-form";

export const Route = createFileRoute("/app/expenses/$expenseId/edit")({
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "expenses:update");
	},
	head: () => ({
		meta: [{ title: "Edit Expense / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: "Edit Expense",
	},
});

function RouteComponent() {
	const expense = useRouteContext({
		from: "/app/expenses/$expenseId",
		select: (state) => state.expense,
	});
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
