import { getRouteApi, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function CreditNoteDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-48" />
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Skeleton className="h-64 lg:col-span-2" />
				<Skeleton className="h-64" />
			</div>
			<Skeleton className="h-40" />
		</div>
	);
}

const STATUS_VARIANT = {
	active: "success",
	partially_redeemed: "info",
	fully_redeemed: "secondary",
	expired: "destructive",
} as const;

export function CreditNoteDetails() {
	const creditNote = getRouteApi("/app/credit-notes/$creditNoteId/details").useLoaderData();

	if (!creditNote) {
		return <p className="text-muted-foreground">Credit note not found.</p>;
	}

	const memberName = toTitleCase(`${creditNote.member.firstName} ${creditNote.member.lastName}`);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">
						Credit Note {creditNote.creditNoteNo}
					</h1>
					<p className="text-muted-foreground">Issued to {memberName}</p>
				</div>
				<Badge variant={STATUS_VARIANT[creditNote.status]} className="capitalize text-sm">
					{creditNote.status.replace(/_/g, " ")}
				</Badge>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card className="shadow-none lg:col-span-2">
					<CardHeader>
						<CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Details
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground">Member</p>
								<p className="font-medium">
									{memberName} (#{creditNote.member.memberNo})
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Membership Plan</p>
								<p className="font-medium">{creditNote.originalMembership.membershipPlan.name}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Originating Receipt</p>
								<p className="font-medium">
									<Link
										to="/app/receipts/$receiptId/details"
										params={{ receiptId: creditNote.originalPayment.id }}
										className="text-primary hover:underline"
									>
										{creditNote.originalPayment.paymentNo}
									</Link>
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Issued By</p>
								<p className="font-medium capitalize">
									{creditNote.issuedByUser.name.toLowerCase()}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Unused Days</p>
								<p className="font-medium">{creditNote.unusedDays} day(s)</p>
							</div>
							<div>
								<p className="text-muted-foreground">Daily Rate</p>
								<p className="font-medium">{currencyFormatter(creditNote.dailyRate)}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Expires</p>
								<p className="font-medium">{dateFormat(creditNote.expiresAt, "long")}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Issued On</p>
								<p className="font-medium">{dateFormat(creditNote.createdAt, "long")}</p>
							</div>
						</div>
						<Separator />
						<div>
							<p className="text-muted-foreground text-sm">Reason</p>
							<p className="text-sm">{creditNote.reason}</p>
						</div>
					</CardContent>
				</Card>

				<Card className="shadow-none">
					<CardHeader>
						<CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Balance
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Credit subtotal</span>
							<span>{currencyFormatter(creditNote.creditSubtotal)}</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">VAT</span>
							<span>{currencyFormatter(creditNote.creditTax)}</span>
						</div>
						<Separator />
						<div className="flex justify-between font-medium">
							<span>Total credited</span>
							<span>{currencyFormatter(creditNote.amount)}</span>
						</div>
						<div className="flex justify-between font-bold text-base">
							<span>Balance remaining</span>
							<span>{currencyFormatter(creditNote.balanceRemaining)}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card className="shadow-none">
				<CardHeader>
					<CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Redemption History
					</CardTitle>
				</CardHeader>
				<CardContent>
					{creditNote.redemptions.length === 0 ? (
						<p className="text-sm text-muted-foreground">No redemptions yet.</p>
					) : (
						<div className="space-y-3">
							{creditNote.redemptions.map((redemption) => (
								<div
									key={redemption.id}
									className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0 text-sm"
								>
									<div>
										<p className="font-medium">
											{redemption.payment ? (
												<Link
													to="/app/receipts/$receiptId/details"
													params={{ receiptId: redemption.payment.id }}
													className="text-primary hover:underline"
												>
													Receipt #{redemption.payment.paymentNo}
												</Link>
											) : redemption.addonInvoice ? (
												<Link
													to="/app/receipts/addons/$addonInvoiceId/details"
													params={{ addonInvoiceId: redemption.addonInvoice.id }}
													className="text-primary hover:underline"
												>
													Addon Invoice #{redemption.addonInvoice.invoiceNo}
												</Link>
											) : (
												"—"
											)}
										</p>
										<p className="text-muted-foreground">
											{dateFormat(redemption.redeemedAt, "long")}
										</p>
									</div>
									<Badge variant="outline">{currencyFormatter(redemption.amountApplied)}</Badge>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
