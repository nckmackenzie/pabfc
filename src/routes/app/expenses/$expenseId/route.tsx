import { assertCanAny } from "@/lib/permissions/can";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { expenseQueries } from "@/features/expenses/services/queries";

export const Route = createFileRoute("/app/expenses/$expenseId")({
	beforeLoad: async ({ params: { expenseId }, context }) => {
		assertCanAny(context.auth, ["expenses:view", "expenses:update"]);
		const { queryClient } = context;
		const expense = await queryClient.ensureQueryData(expenseQueries.detail(expenseId));
		if (!expense) {
			throw notFound();
		}
		return { expense };
	},
	component: RouteComponent,
});

function RouteComponent() {
	return <Outlet />;
}
