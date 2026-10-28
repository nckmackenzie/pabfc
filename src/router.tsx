import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { Spinner } from "@/components/ui/spinner";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultPendingMs: 100,
		defaultPendingComponent: () => (
			<div className="flex justify-center p-8">
				<Spinner className="size-6 text-primary" />
			</div>
		),
		Wrap: (props: { children: React.ReactNode }) => {
			return <TanstackQuery.Provider {...rqContext}>{props.children}</TanstackQuery.Provider>;
		},
	});

	setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient });

	return router;
};
