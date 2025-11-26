import {
	ConstructionIcon,
	HammerIcon,
	RocketIcon,
} from "@/components/ui/icons";
import { PageWrapperWithBackLink } from "./edit-page-wrapper";

export function Wip() {
	return (
		<PageWrapperWithBackLink
			wrapperSize="sm"
			backPath="/app/dashboard"
			buttonText="Back to Dashboard"
		>
			<div className="p-8 md:p-12 text-center">
				<div className="mx-auto mb-8 relative w-24 h-24 flex items-center justify-center">
					<div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
					<div className="relative bg-card p-4 rounded-full shadow-sm border border-border">
						<ConstructionIcon className="h-10 w-10 text-primary" />
					</div>
					<div className="absolute -top-1 -right-1 bg-card p-1.5 rounded-full shadow-sm border border-border animate-bounce delay-700">
						<HammerIcon className="h-4 w-4 text-warning-foreground" />
					</div>
				</div>

				<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
					We&apos;re building something&nbsp;
					<span className="text-transparent bg-clip-text bg-primary">
						awesome
					</span>
					.
				</h1>

				<p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
					This feature is currently <strong>Work in Progress</strong>. We're
					fine-tuning the details to ensure it provides the best experience for
					you.
				</p>
			</div>

			<div className="bg-muted/30 p-4 text-center border-t border-border">
				<p className="text-xs text-muted-foreground/70 flex items-center justify-center gap-1">
					<RocketIcon className="h-3 w-3" /> Expected launch:{" "}
					<span className="font-medium text-muted-foreground">Soon</span>
				</p>
			</div>
		</PageWrapperWithBackLink>
	);
}

// 	<div
// 		className={cn(
// 			"bg-linear-to-b from-background to-muted/50 flex items-center justify-center ",
// 			{
// 				"h-[calc(100vh-4rem)]": !fullPage,
// 				"min-h-screen": fullPage,
// 			},
// 		)}
// 	>
// 		<div className="max-w-2xl w-full">
// 			<div className="mb-8">
// 				<BackLink href="/app/dashboard">Back to Dashboard</BackLink>
// 			</div>

// 			<Card className="overflow-hidden relative">
// 				<div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary via-chart-2 to-chart-3"></div>
// 				<div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-muted/30 opacity-50 blur-3xl"></div>

// 				<div className="p-8 md:p-12 text-center">
// 					<div className="mx-auto mb-8 relative w-24 h-24 flex items-center justify-center">
// 						<div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
// 						<div className="relative bg-card p-4 rounded-full shadow-sm border border-border">
// 							<ConstructionIcon className="h-10 w-10 text-primary" />
// 						</div>
// 						<div className="absolute -top-1 -right-1 bg-card p-1.5 rounded-full shadow-sm border border-border animate-bounce delay-700">
// 							<HammerIcon className="h-4 w-4 text-warning-foreground" />
// 						</div>
// 					</div>

// 					<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
// 						We're building something
// 						<span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-chart-2">
// 							awesome
// 						</span>
// 						.
// 					</h1>

// 					<p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
// 						This feature is currently <strong>Work in Progress</strong>. We're
// 						fine-tuning the details to ensure it provides the best experience
// 						for you.
// 					</p>
// 				</div>

// 				<div className="bg-muted/30 p-4 text-center border-t border-border">
// 					<p className="text-xs text-muted-foreground/70 flex items-center justify-center gap-1">
// 						<RocketIcon className="h-3 w-3" /> Expected launch:{" "}
// 						<span className="font-medium text-muted-foreground">Q4 2025</span>
// 					</p>
// 				</div>
// 			</Card>
// 		</div>
// 	</div>
// );
