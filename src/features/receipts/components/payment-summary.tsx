import { ArrowDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { currencyFormatter } from "@/lib/helpers";

export type AddonSummaryLine = {
	name: string;
	unitAmount: number;
	numberOfPeriods: number;
	numberOfMembers: number;
	perMember: boolean;
	lineTotal: number;
};

type PaymentSummaryProps = {
	mode?: "membership" | "addon";
	memberName: string;
	reference: string;
	currentPlanName?: string;
	currentPeriodStart?: string;
	currentPeriodEnd?: string;
	newPlanName?: string;
	newPeriodStart?: string;
	newPeriodEnd?: string;
	planPrice?: number;
	discountAmount?: number;
	amountDue?: number;
	taxAmount?: number;
	// Tax-inclusive membership total (defaults to amountDue when no VAT applies).
	membershipTotal?: number;
	addonLines?: AddonSummaryLine[];
	addonSubtotal?: number;
};

function getInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PaymentSummary({
	mode = "membership",
	memberName,
	reference,
	currentPlanName,
	currentPeriodStart,
	currentPeriodEnd,
	newPlanName,
	newPeriodStart,
	newPeriodEnd,
	planPrice = 0,
	discountAmount = 0,
	amountDue = 0,
	taxAmount = 0,
	membershipTotal,
	addonLines = [],
	addonSubtotal = 0,
}: PaymentSummaryProps) {
	const isMembership = mode === "membership";
	const hasAddons = addonLines.length > 0;
	// Fall back to amountDue when the caller doesn't supply a VAT-inclusive total.
	const membershipDue = isMembership ? (membershipTotal ?? amountDue) : 0;
	const grandTotal = membershipDue + addonSubtotal;

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

				{isMembership && (
					<>
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
						{taxAmount > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">VAT</span>
								<span>{currencyFormatter(taxAmount)}</span>
							</div>
						)}
						{hasAddons && (
							<div className="flex justify-between text-sm">
								<span className="text-muted-foreground">Membership total</span>
								<span>{currencyFormatter(membershipDue)}</span>
							</div>
						)}
					</>
				)}

				{hasAddons && (
					<>
						<Separator />
						<div className="space-y-2">
							<p className="text-xs font-medium uppercase text-muted-foreground">Addons</p>
							{addonLines.map((addon) => (
								<div key={addon.name} className="flex justify-between text-sm gap-2">
									<span className="text-muted-foreground">
										{addon.name}
										<span className="block text-xs">
											{currencyFormatter(addon.unitAmount)} × {addon.numberOfPeriods}
											{addon.perMember ? ` × ${addon.numberOfMembers} members` : ""}
										</span>
									</span>
									<span className="whitespace-nowrap">{currencyFormatter(addon.lineTotal)}</span>
								</div>
							))}
							<div className="flex justify-between text-sm font-medium">
								<span className="text-muted-foreground">Addon subtotal</span>
								<span>{currencyFormatter(addonSubtotal)}</span>
							</div>
						</div>
					</>
				)}

				<Separator />

				<div className="flex justify-between font-bold text-base">
					<span>{isMembership ? "Amount Due" : "Total"}</span>
					<span>{currencyFormatter(grandTotal)}</span>
				</div>
			</CardContent>
		</Card>
	);
}
