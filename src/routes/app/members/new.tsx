import { createFileRoute } from "@tanstack/react-router";
import z from "zod";
import { PageWrapperWithBackLink } from "@/components/ui/edit-page-wrapper";
import { FormLoader } from "@/components/ui/loaders";
import { MemberForm } from "@/features/members/components/member-form";
import { requirePermission } from "@/lib/permissions/permissions";

export const Route = createFileRoute("/app/members/new")({
	beforeLoad: async () => {
		await requirePermission("members:create");
	},
	validateSearch: z.object({
		tab: z
			.enum(["personal", "contact", "emergency"])
			.optional()
			.catch("personal"),
	}),
	pendingComponent: () => <FormLoader />,
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "New Member / Prime Age Beauty & Fitness Center" }],
	}),
	staticData: {
		breadcrumb: "New Member",
	},
});

function RouteComponent() {
	return (
		<PageWrapperWithBackLink backPath="/app/members" buttonText="Members List">
			<MemberForm />
		</PageWrapperWithBackLink>
	);
}
