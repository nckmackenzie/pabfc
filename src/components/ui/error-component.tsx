import { Link } from "@tanstack/react-router";
import {
	Alert,
	AlertContent,
	AlertDescription,
	AlertIcon,
	AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, AlertTriangleIcon } from "@/components/ui/icons";
// import { BackLink } from '@/components/ui/links'
import { cn } from "@/lib/utils";

interface ErrorProps {
	title?: string;
	message?: string;
	action?: {
		label?: string;
		onClick: () => void;
	};
	className?: string;
}

export function ErrorComponent({
	title = "Something went wrong",
	message = "An unexpected error occurred. Please try again later.",
	action,
	className,
}: ErrorProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4",
				className,
			)}
		>
			<AlertCircleIcon
				className="w-16 h-16 text-destructive mb-4"
				aria-hidden="true"
			/>
			<h1 className="text-4xl font-bold mb-2">{title}</h1>
			<p className="text-xl mb-4">
				We're sorry, but an error occurred while processing your request.
			</p>
			<p className="text-muted-foreground mb-6">
				Error: {message || "Unknown error"}
			</p>
			<div className="flex items-center gap-4">
				<Button asChild variant="default">
					<Link to="..">Go Back</Link>
				</Button>
				{action && (
					<Button onClick={action.onClick} variant="default">
						{action.label || "Retry"}
					</Button>
				)}
			</div>
		</div>
	);
}

export function AlertErrorComponent({
	title = "Something went wrong",
	message = "An unexpected error occurred. Please try again later.",
	className,
}: ErrorProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center w-full lg:max-w-2xl mx-auto",
				className,
			)}
		>
			<Alert variant="destructive" appearance="light" close={false}>
				<AlertIcon>
					<AlertTriangleIcon />
				</AlertIcon>
				<AlertContent>
					<AlertTitle>{title}</AlertTitle>
					<AlertDescription>
						<p>{message}</p>
						{/* TODO: ADD BACK LINK USING useGoBack hook */}
						{/* <div className="space-x-3.5 flex items-center">
              <BackLink variant="foreground" size="md">
                Go Back
              </BackLink>
            </div> */}
					</AlertDescription>
				</AlertContent>
			</Alert>
		</div>
	);
}
