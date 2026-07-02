import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { HUMAN_RESOURCES_REPORT_CARDS } from "@/features/reports/lib/constants";
import type { Permission } from "@/lib/permissions/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/human-resources/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Human Resources Reports / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Human Resources Reports"
				description="Select an HR report to review leave utilisation and employee advance recovery data."
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
				{HUMAN_RESOURCES_REPORT_CARDS.map((card) => (
					<ReportCard
						key={card.to}
						title={card.title}
						description={card.description}
						to={card.to}
						Icon={card.icon}
						permission={card.permission}
					/>
				))}
			</div>
		</div>
	);
}

function ReportCard({
	title,
	description,
	to,
	Icon,
	permission,
}: {
	title: string;
	description: string;
	to: string;
	Icon: LucideIcon;
	permission: Permission;
}) {
	return (
		<PermissionGate permission={permission} loadingComponent={<ReportCardSkeleton />}>
			<div className="group relative p-4 border flex flex-col gap-2 bg-card rounded-lg shadow-sm transition-all hover:border-primary/30 hover:shadow-lg duration-200">
				<div className="size-10 flex items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
					<Icon className="size-5" />
				</div>
				<div className="space-y-1">
					<h3 className="font-semibold text-foreground">{title}</h3>
					<p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
				</div>
				<Link
					to={to}
					className={cn(
						buttonVariants({ variant: "secondary", size: "icon-sm" }),
						"ml-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity rounded-full"
					)}
				>
					<span className="absolute inset-0" aria-hidden="true" />
					<span className="sr-only">Open {title} report</span>
					<ArrowRightIcon className="size-4" aria-hidden="true" />
				</Link>
			</div>
		</PermissionGate>
	);
}

function ReportCardSkeleton() {
	return (
		<div className="relative p-4 border flex flex-col gap-2 bg-card rounded-lg shadow-sm">
			<Skeleton className="size-10 rounded-full" />
			<div className="space-y-1">
				<Skeleton className="h-4 w-28" />
				<Skeleton className="h-3 w-48 mt-1" />
			</div>
			<Skeleton className="size-7 rounded-full ml-auto" />
		</div>
	);
}
