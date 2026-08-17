import { ChevronDownIcon, ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const INDENT_PER_LEVEL_PX = 20;
/** Keeps rows without a chevron aligned with the labels of rows that have one. */
const CHEVRON_OFFSET_PX = 20;

export function indentStyle(depth: number, extraPx = 0) {
	return { paddingLeft: depth * INDENT_PER_LEVEL_PX + extraPx };
}

/**
 * Account label for a report row that can be drilled into one level at a time.
 * Rows with children toggle their inline expansion; leaf rows render as plain
 * text, indented to stay aligned with their expandable siblings.
 */
export function ReportAccountLabel({
	label,
	depth,
	isExpandable,
	isExpanded,
	onToggle,
	className,
}: {
	label: string;
	depth: number;
	isExpandable: boolean;
	isExpanded: boolean;
	onToggle: () => void;
	className?: string;
}) {
	if (!isExpandable) {
		return (
			<span className={className} style={indentStyle(depth, CHEVRON_OFFSET_PX)}>
				{label}
			</span>
		);
	}

	return (
		<button
			type="button"
			className={cn("flex items-center gap-1 text-left cursor-pointer hover:underline", className)}
			style={indentStyle(depth)}
			aria-expanded={isExpanded}
			onClick={onToggle}
		>
			{isExpanded ? (
				<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
			) : (
				<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
			)}
			{label}
		</button>
	);
}

/** Clickable report amount that drills into the row it belongs to. */
export function ReportAmountButton({
	amount,
	onClick,
	className,
}: {
	amount: string;
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			className={cn(
				"font-medium cursor-pointer text-blue-500 transition-all hover:text-blue-600 hover:underline",
				className
			)}
			onClick={onClick}
		>
			{amount}
		</button>
	);
}

/**
 * Loading, error and empty states for a single expanded row. These stay scoped
 * to the row being expanded rather than the page-level Suspense boundary.
 */
export function ReportRowLoading({ depth }: { depth: number }) {
	return (
		<div
			className="flex items-center gap-2 py-1.5 text-muted-foreground"
			style={indentStyle(depth, CHEVRON_OFFSET_PX)}
		>
			<Spinner />
			<span>Loading accounts...</span>
		</div>
	);
}

export function ReportRowError({
	depth,
	message,
	onRetry,
}: {
	depth: number;
	message?: string;
	onRetry: () => void;
}) {
	return (
		<div
			className="flex items-center gap-2 py-1.5 text-destructive"
			style={indentStyle(depth, CHEVRON_OFFSET_PX)}
		>
			<TriangleAlertIcon className="size-4 shrink-0" />
			<span>{message || "Unable to load child accounts."}</span>
			<button type="button" className="underline cursor-pointer font-medium" onClick={onRetry}>
				Retry
			</button>
		</div>
	);
}

export function ReportRowEmpty({ depth, message }: { depth: number; message: string }) {
	return (
		<div
			className="py-1.5 text-muted-foreground italic"
			style={indentStyle(depth, CHEVRON_OFFSET_PX)}
		>
			{message}
		</div>
	);
}
