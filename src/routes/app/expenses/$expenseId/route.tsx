import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { expenseQueries } from "@/features/expenses/services/queries";
import { requireAnyPermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/expenses/$expenseId")({
	beforeLoad: async ({ params: { expenseId }, context: { queryClient } }) => {
		await requireAnyPermission(["expenses:view", "expenses:update"]);
		const expense = await queryClient.ensureQueryData(
			expenseQueries.detail(expenseId),
		);
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
