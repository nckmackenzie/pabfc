import { createFileRoute, notFound } from "@tanstack/react-router";
import { startOfMonth } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-range";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { CheckCircleIcon, XCircleIcon } from "@/components/ui/icons";
import { ProtectedPageWithWrapper } from "@/components/ui/protected-page-with-wrapper";
import { PlanRevenue } from "@/features/plans/components/plan-revenue";
import { planQueries } from "@/features/plans/services/queries";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { dateRangeWithSearchSchema } from "@/lib/schema-rules";
import { toTitleCase } from "@/lib/utils";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/plans/$planId/revenue")({
	beforeLoad: async () => {
		await requirePermission("plans:view-plan-revenue")
	},
	validateSearch: dateRangeWithSearchSchema,
	head: () => ({
		meta: [{ title: "Plan Revenue / Prime Age Beauty & Fitness Centre" }],
	}),
	loader: async ({ context: { queryClient }, params: { planId } }) => {
		const [plan] = await Promise.all([
			queryClient.ensureQueryData(planQueries.detail(planId)),
		]);
		if (!plan) throw notFound();
		return { plan };
	},
	component: RouteComponent,
	errorComponent: ({ error }) => (
		<AlertErrorComponent message={error.message} />
	),
});

function RouteComponent() {
	const {
		plan: { name, price, active },
	} = Route.useLoaderData();
	const {
		filters: { from, to },
		setFilters,
	} = useFilters(Route.id);
	return (
		<ProtectedPageWithWrapper
			permissions={["plans:view-plan-revenue"]}
			hasBackLink
			backPath="/app/plans"
			buttonText="Back to Plans"
		>
			<header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div className="space-y-0.5">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-semibold font-display">
							{toTitleCase(name.toLowerCase())}
						</h1>
						<Badge variant={active ? "success" : "destructive"}>
							{active ? (
								<CheckCircleIcon className="size-4!" />
							) : (
								<XCircleIcon className="size-4!" />
							)}
							{active ? "Active" : "Inactive"}
						</Badge>
					</div>
					<div className="text-sm text-muted-foreground flex items-center">
						<p>Revenue analytics.</p>
						{price && (
							<Badge variant="secondary">{currencyFormatter(price)}</Badge>
						)}
					</div>
				</div>
				<DatePicker
					initialDateRange={{
						from: from ? new Date(from) : startOfMonth(new Date()),
						to: to ? new Date(to) : new Date(),
					}}
					onReset={() =>
						setFilters({
							from: dateFormat(startOfMonth(new Date())),
							to: dateFormat(new Date()),
						})
					}
					onDateChange={(range) =>
						setFilters({
							from: range.from ? dateFormat(range.from) : undefined,
							to: range.to ? dateFormat(range.to) : undefined,
						})
					}
				/>
			</header>
			<PlanRevenue />
		</ProtectedPageWithWrapper>
	);
}
