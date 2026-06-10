import { type Toast, toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { XIcon } from "./icons";

interface Props {
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
						<p className={cn("text-sm font-medium")}>{title}</p>
						<p className="mt-1 text-sm ">{message}</p>
					</div>
				</div>
			</div>
			{t?.id ? (
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					onClick={() => t?.id && toast.dismiss(t.id)}
					aria-label="Dismiss notification"
					className="hover:bg-transparent hover:text-primary"
				>
					<XIcon />
				</Button>
			) : null}
		</div>
	);
}
