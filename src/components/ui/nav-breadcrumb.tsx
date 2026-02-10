import { type AnyRouteMatch, Link, useMatches } from "@tanstack/react-router";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type BreadcrumbValue =
	| string
	| string[]
	| ((match: AnyRouteMatch) => string | string[]);

type ResolvedBreadcrumbItem = {
	path: string;
	label: string;
};

export function RouterBreadcrumb() {
	const matches = useMatches();

	const breadcrumbs: ResolvedBreadcrumbItem[] = matches.flatMap((match) => {
		const staticData = match.staticData;
		if (!staticData?.breadcrumb) return [];

		// If breadcrumb is a function, only resolve it if loader data is available
		if (typeof staticData.breadcrumb === "function") {
			// Skip if match hasn't successfully loaded yet
			if (match.status !== "success" || !match.loaderData) {
				return [];
			}
			const breadcrumbValue = staticData.breadcrumb(match);
			const items = Array.isArray(breadcrumbValue)
				? breadcrumbValue
				: [breadcrumbValue];
			return items.map((item) => ({
				label: item,
				path: match.pathname,
			}));
		}

		// Static breadcrumbs are safe to use immediately
		const items = Array.isArray(staticData.breadcrumb)
			? staticData.breadcrumb
			: [staticData.breadcrumb];

		return items.map((item) => ({
			label: item,
			path: match.pathname,
		}));
	});

	if (breadcrumbs.length === 0) {
		return null;
	}

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{breadcrumbs.map((crumb, index) => {
					const isLast = index === breadcrumbs.length - 1;

					return (
						<Fragment key={`${crumb.path}-${index}`}>
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage>{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link to={crumb.path}>{crumb.label}</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{!isLast && <BreadcrumbSeparator />}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
