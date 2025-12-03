import { type ComponentProps, type ReactNode, useTransition } from "react";
import toast from "react-hot-toast";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { cn } from "@/lib/utils";
import { ToastContent } from "./toast-content";

export function ActionButton({
	action,
	requireAreYouSure = false,
	areYouSureDescription = "This action cannot be undone.",
	isDestructive = true,
	...props
}: ComponentProps<typeof Button> & {
	action: () => Promise<{ error: boolean; message?: string }>;
	requireAreYouSure?: boolean;
	isDestructive?: boolean;
	areYouSureDescription?: ReactNode;
}) {
	const [isLoading, startTransition] = useTransition();

	function performAction() {
		startTransition(async () => {
			const data = await action();
			if (data.error) {
				toast.error((t) => (
					<ToastContent t={t} title="Error" message={data.message || "Error"} />
				));
				return;
			}
			toast.success((t) => (
				<ToastContent
					t={t}
					title="Action completed successfully!"
					message={data.message || "Success"}
				/>
			));
		});
	}

	if (requireAreYouSure) {
		return (
			<AlertDialog open={isLoading ? true : undefined}>
				<AlertDialogTrigger asChild>
					<Button {...props} />
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							{areYouSureDescription}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={isLoading}
							onClick={performAction}
							className={cn(
								"",
								isDestructive ? "bg-red-500 hover:bg-red-600" : "",
							)}
						>
							<LoadingSwap isLoading={isLoading}>Yes</LoadingSwap>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	return (
		<Button
			{...props}
			disabled={props.disabled ?? isLoading}
			onClick={(e) => {
				performAction();
				props.onClick?.(e);
			}}
		>
			<LoadingSwap
				isLoading={isLoading}
				className="inline-flex items-center gap-2"
			>
				{props.children}
			</LoadingSwap>
		</Button>
	);
}
