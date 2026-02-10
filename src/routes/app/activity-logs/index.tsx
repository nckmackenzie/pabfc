import { createFileRoute } from "@tanstack/react-router";
import { BasePageComponent } from "@/components/ui/base-page";
import { ActivtyTable } from "@/features/activity-logs/components/activity-table";
import { ActivityLogFilters } from "@/features/activity-logs/components/filters";
import { activityLogValidateSearch } from "@/features/activity-logs/services/schemas";

export const Route = createFileRoute("/app/activity-logs/")({
	validateSearch: activityLogValidateSearch,
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Activity Logs / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "Activity Logs",
	},
});

function RouteComponent() {
	return (
		<BasePageComponent
			pageTitle="Activity Logs"
			pageDescription="Track user activity, including actions, timestamps and details."
			customFilters={<ActivityLogFilters />}
		>
			<ActivtyTable />
		</BasePageComponent>
	);
}
