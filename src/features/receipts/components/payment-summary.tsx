import { ArrowDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { currencyFormatter } from "@/lib/helpers";

type PaymentSummaryProps = {
	memberName: string;
	reference: string;
	currentPlanName: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	newPlanName: string;
	newPeriodStart: string;
	newPeriodEnd: string;
	planPrice: number;
	discountAmount: number;
	amountDue: number;
};

function getInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PaymentSummary({
	memberName,
	reference,
	currentPlanName,
	currentPeriodStart,
	currentPeriodEnd,
	newPlanName,
	newPeriodStart,
	newPeriodEnd,
	planPrice,
	discountAmount,
	amountDue,
}: PaymentSummaryProps) {
	return (
		<Card className="shadow-none">
			<CardHeader>
				<CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Payment Summary
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-3">
					<Avatar>
						<AvatarFallback>{getInitials(memberName) || "—"}</AvatarFallback>
					</Avatar>
					<div>
						<p className="font-medium">{memberName || "Select a member"}</p>
						<p className="text-sm text-muted-foreground">Ref: {reference || "—"}</p>
					</div>
				</div>

				<Separator />

				<div>
					<p className="text-xs font-medium uppercase text-muted-foreground">Current Membership</p>
					<p className="text-sm">{currentPlanName || "—"}</p>
					<p className="text-sm text-muted-foreground">
						{currentPeriodStart && currentPeriodEnd
							? `${currentPeriodStart} → ${currentPeriodEnd}`
							: "—"}
					</p>
				</div>

				<div className="flex justify-center text-muted-foreground">
					<ArrowDown className="h-4 w-4" />
				</div>

				<div>
					<p className="text-xs font-medium uppercase text-muted-foreground">New Membership</p>
					<p className="text-sm font-medium text-primary">{newPlanName || "—"}</p>
					<p className="text-sm text-muted-foreground">
						{newPeriodStart && newPeriodEnd ? `${newPeriodStart} → ${newPeriodEnd}` : "—"}
					</p>
				</div>

				<Separator />

				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">Plan price</span>
					<span>{currencyFormatter(planPrice)}</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-muted-foreground">Discount</span>
					<span className="text-green-600">-{currencyFormatter(discountAmount)}</span>
				</div>

				<Separator />

				<div className="flex justify-between font-bold text-base">
					<span>Amount Due</span>
					<span>{currencyFormatter(amountDue)}</span>
				</div>
			</CardContent>
		</Card>
	);
}
