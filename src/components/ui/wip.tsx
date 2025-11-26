import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	ArrowLeftIcon,
	ConstructionIcon,
	HammerIcon,
	RocketIcon,
} from "@/components/ui/icons";
import { Wrapper } from "@/components/ui/wrapper";
import { cn } from "@/lib/utils";

export function Wip({
	displayBackButton = true,
	transparent = false,
}: {
	displayBackButton?: boolean;
	transparent?: boolean;
}) {
	const router = useRouter();
	return (
		<Wrapper size="sm" className={cn(transparent && "shadow-none!")}>
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
				{displayBackButton && (
					<Button
						variant="default"
						onClick={() => router.history.back()}
						className="w-full md:w-xs"
					>
						<ArrowLeftIcon />
						Go Back
					</Button>
				)}
			</div>

			<div
				className={cn(
					"bg-muted/30 p-4 text-center",
					!transparent && "border-t border-border",
				)}
			>
				<p className="text-xs text-muted-foreground/70 flex items-center justify-center gap-1">
					<RocketIcon className="h-3 w-3" /> Expected launch:{" "}
					<span className="font-medium text-muted-foreground">Soon</span>
				</p>
			</div>
		</Wrapper>
	);
}
