import { createFileRoute } from "@tanstack/react-router";
import { FormLoader } from "@/components/ui/loaders";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { ExpenseForm } from "@/features/expenses/components/expense-form";

export const Route = createFileRoute("/app/expenses/new")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Expense / Prime Age Beauty & Fitness Center" }],
	}),
	pendingComponent: FormLoader,
});

function RouteComponent() {
	return (
		<ProtectedPageWithWrapper
			permissions={["expenses:create"]}
			hasBackLink
			buttonText="Expenses List"
			backPath="/app/expenses"
		>
			<ExpenseForm />
		</ProtectedPageWithWrapper>
	);
}
