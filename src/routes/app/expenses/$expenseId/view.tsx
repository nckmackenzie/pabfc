import { assertCan } from "@/lib/permissions/can";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ExpenseForm } from "@/features/expenses/components/expense-form";

export const Route = createFileRoute("/app/expenses/$expenseId/view")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		assertCan(context.auth, "expenses:view");
	},
	head: () => ({
		meta: [{ title: "Expense View / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: FormLoader,
	staticData: {
		breadcrumb: `View Expense`,
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
			permissions={["expenses:view"]}
		>
			<ExpenseForm expenseNo={expense.expenseNo} expense={expense} isView />
		</ProtectedPageWithWrapper>
	);
}
