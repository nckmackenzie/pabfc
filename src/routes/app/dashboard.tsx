import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Wrapper } from "@/components/ui/wrapper";
import { useSession } from "@/lib/auth/client";
import { getUserPermissions } from "@/lib/permissions/permissions-service";

export const Route = createFileRoute("/app/dashboard")({
	head: () => ({
		meta: [{ title: "Dashboard / Prime Age Beauty & Fitness Center" }],
	}),
	component: RouteComponent,
});

function RouteComponent() {
	const { data: session } = useSession();
	const queryClient = useQueryClient();
	useEffect(() => {
		queryClient.prefetchQuery({
			queryKey: ["permissions", session?.user.id],
			queryFn: () => getUserPermissions(),
		});
	}, [queryClient, session?.user.id]);
	return (
		<Wrapper size="full">
			<PageHeader title="Dashboard" description="Welcome to your dashboard" />
		</Wrapper>
	);
}
