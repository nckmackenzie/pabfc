import { Badge } from "@/components/ui/badge";
import { CheckIcon, LoaderIcon, ResetIcon, XIcon } from "@/components/ui/icons";

export function PaymentStatusBadge({ status }: { status: string }) {
	return (
		<Badge
			variant={
				status === "completed"
					? "success"
					: status === "pending"
						? "info"
						: status === "refunded"
							? "warning"
							: status === "voided"
								? "destructive"
								: "secondary"
			}
			className="capitalize"
		>
			{status === "completed" ? (
				<CheckIcon />
			) : status === "refunded" ? (
				<ResetIcon />
			) : status === "pending" ? (
				<LoaderIcon className="animate-spin" />
			) : (
				<XIcon />
			)}
			<span>{status}</span>
		</Badge>
	);
}
