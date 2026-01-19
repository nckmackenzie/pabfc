import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPage } from "@/components/ui/protected-page";
import { BroadcastArea } from "@/features/communication/components/broadcast-area";
import { TemplateArea } from "@/features/communication/components/template-area";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import { planQueries } from "@/features/plans/services/queries";

export const Route = createFileRoute("/app/communication/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Communication / Prime Age Beauty & Fitness Center" }],
	}),
	loader: async ({ context: { queryClient } }) => {
		const [templates, plans] = await Promise.all([
			queryClient.ensureQueryData(smsTemplateQueries.list()),
			queryClient.ensureQueryData(planQueries.active()),
		]);
		return { templates, plans };
	},
});

function RouteComponent() {
	return (
		<ProtectedPage permissions={["communication:view"]}>
			<div className="flex flex-col gap-4">
				<div className="grid md:grid-cols-3 gap-4 items-start flex-1">
					<BroadcastArea />
					<TemplateArea />
				</div>
			</div>
		</ProtectedPage>
	);
}
