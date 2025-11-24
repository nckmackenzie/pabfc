import type { Toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { ColorVariant } from "@/types/index.types";

interface Props {
	state?: ColorVariant;
	title: string;
	message: string;
	t?: Toast;
}

export function ToastContent({ message, title, t }: Props) {
	return (
		<div className="w-full rounded-lg pointer-events-auto flex">
			<div className="flex-1">
				<div className="flex items-start pr-4">
					<div className="ml-3 flex-1">
						<p
							className={cn("text-sm font-medium text-foreground", {
								"text-toast-foreground-error": t?.type === "error",
								"text-toast-foreground-success": t?.type === "success",
							})}
						>
							{title}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">{message}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
