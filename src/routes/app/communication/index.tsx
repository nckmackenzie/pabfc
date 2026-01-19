import { createFileRoute } from "@tanstack/react-router";
import { ProtectedPage } from "@/components/ui/protected-page";
import { Wrapper } from "@/components/ui/wrapper";
import { TemplateArea } from "@/features/communication/components/template-area";

export const Route = createFileRoute("/app/communication/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Communication / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	return (
		<ProtectedPage permissions={["communication:view"]}>
			<div className="grid md:grid-cols-3 gap-4 items-start">
				<Wrapper className="col-span-2">message area</Wrapper>

				<TemplateArea />
			</div>
		</ProtectedPage>
	);
}
