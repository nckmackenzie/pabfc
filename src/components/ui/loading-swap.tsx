import type { ReactNode } from "react";
import { LoaderIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export function LoadingSwap({
	isLoading,
	children,
	className,
}: {
	isLoading: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className="grid grid-cols-1 items-center justify-items-center">
			<div
				className={cn(
					"col-start-1 col-end-2 row-start-1 row-end-2 w-full flex items-center justify-center gap-2",
					isLoading ? "invisible" : "visible",
					className,
				)}
			>
				{children}
			</div>
			<div
				className={cn(
					"col-start-1 col-end-2 row-start-1 row-end-2 flex items-center justify-center gap-2",
					isLoading ? "visible" : "invisible",
					className,
				)}
			>
				<LoaderIcon className="animate-spin" />
			</div>
		</div>
	);
}
