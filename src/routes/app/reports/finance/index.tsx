import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { REPORT_CARDS } from "@/features/reports/lib/constants";
import type { Permission } from "@/lib/permissions/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/reports/finance/")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: "Finance Reports / Prime Age Beauty & Fitness Center" }],
	}),
});

function RouteComponent() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Finance Reports"
				description="Select a report type to view detailed financial data"
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
				{REPORT_CARDS.map((card) => (
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
		<PermissionGate
			permission={permission}
			loadingComponent={<ReportCardSkeleton />}
		>
			<div className="group relative p-4 border flex flex-col gap-2 bg-card rounded-lg shadow-sm transition-all hover:border-primary/30 hover:shadow-lg duration-200">
				<div className="size-10 flex items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
					<Icon className="size-5" />
				</div>
				<div className="space-y-1">
					<h3 className="font-semibold">{title}</h3>
					<p className="text-sm text-muted-foreground mt-1">{description}</p>
				</div>
				<Link
					to={to}
					className={cn(
						buttonVariants({ variant: "default", size: "icon-sm" }),
						"ml-auto opacity-0 group-hover:opacity-100 transition-opacity rounded-full",
					)}
				>
					<span className="absolute inset-0"></span>
					<ArrowRightIcon className="size-4" />
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
