import { PDFDownloadLink } from "@react-pdf/renderer";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowUpCircle, Download, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomAlert } from "@/components/ui/custom-alert";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useReceiptNo } from "@/features/receipts/hooks/use-receipt-no";
import { paymentsQueries } from "@/features/receipts/services/queries";
import { usePermissions } from "@/hooks/use-permissions";
import { dateFormat } from "@/lib/helpers";
import { GymReceiptPdf } from "./donwloadable-receipt";

export function PaymentDetails() {
	const payment = getRouteApi("/app/receipts/$receiptId/details").useLoaderData();
	const { receiptNo, isLoading: isLoadingReceiptNo } = useReceiptNo(+payment.paymentNo);
	const { hasPermission } = usePermissions();

	// The banner query only needs view access; the eligibility query is gated on
	// receipts:top-up too, since getUpgradeContext requires it server-side — checking
	// client-side first avoids a guaranteed-to-fail request for staff without it.
	const canParticipateInUpgrade = payment.status === "completed" && !!payment.planId;

	const { data: upgradeInfo } = useQuery({
		...paymentsQueries.upgradeInfo(payment.id),
		enabled: canParticipateInUpgrade,
	});
	// Only re-run the (heavier) full eligibility check once we know this payment isn't
	// already one side of an upgrade — avoids an extra round trip on every receipt.
	const { data: upgradeContext } = useQuery({
		...paymentsQueries.upgradeContext(payment.id),
		enabled: canParticipateInUpgrade && upgradeInfo === null && hasPermission("receipts:top-up"),
	});
	const showUpgradeButton =
		canParticipateInUpgrade && upgradeInfo === null && upgradeContext?.eligible === true;
	const { receiptNo: linkedReceiptNo } = useReceiptNo(Number(upgradeInfo?.linkedPaymentNo ?? 0));

	const currencyFormatter = new Intl.NumberFormat("en-KE", {
		style: "currency",
		currency: payment.currency,
	});

	const formattedAmount = currencyFormatter.format(+payment.totalAmount);
	const discountedAmount = currencyFormatter.format(+payment.discountedAmount);
	const taxAmount = currencyFormatter.format(+payment.taxAmount);
	const subTotal = currencyFormatter.format(+payment.amount);
	const periods = payment.numberOfPeriods ?? 1;
	const unitPrice = currencyFormatter.format(Number(payment.plan?.price ?? 0));
	// Void deletes `paymentMembers` rows, so `payment.members` is empty for a voided
	// payment — fall back to the billing member (`payment.member`) directly.
	const coveredMembers =
		payment.members.length > 0 ? payment.members.map(({ member }) => member) : [payment.member];
	const statusBadgeVariant =
		payment.status === "completed"
			? "success"
			: payment.status === "pending"
				? "info"
				: payment.status === "refunded"
					? "warning"
					: payment.status === "voided"
						? "secondary"
						: "destructive";

	const addonLines = payment.addonInvoice?.lines ?? [];
	const addonSubtotalValue = addonLines.reduce((total, line) => total + Number(line.lineTotal), 0);
	// Line items (membership + addons) sum to this combined subtotal.
	const combinedSubtotal = currencyFormatter.format(Number(payment.amount) + addonSubtotalValue);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Receipt details</h1>
					<p className="text-muted-foreground">
						Review transaction information and linked membership plan.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{payment.status !== "voided" && (
						<Button asChild variant="outline">
							<PDFDownloadLink
								document={
									<GymReceiptPdf
										data={{
											receiptNo: payment.paymentNo,
											date: format(new Date(payment.paymentDate), "MMM d, yyyy"),
											members: coveredMembers.map((member) => ({
												name: `${member.firstName} ${member.lastName}`,
												id: member.memberNo.toString(),
												address: "",
											})),
											paymentMethod: payment.method.replace("_", " ").toUpperCase(),
											lineItems: [
												{
													description: `Membership Fee - ${payment.plan?.name}`,
													qty: periods,
													price: periods > 0 ? Number(payment.amount) / periods : 0,
													amount: Number(payment.amount),
												},
												...addonLines.map((line) => ({
													description: `${line.addonName}${line.perMember ? ` (per member × ${line.numberOfMembers})` : ""}`,
													qty: line.numberOfPeriods,
													price: Number(line.unitAmount),
													amount: Number(line.lineTotal),
												})),
											],
											subtotal: Number(payment.amount) + addonSubtotalValue,
											discount: Number(payment.discountedAmount),
											tax: Number(payment.taxAmount),
											total: Number(payment.totalAmount),
										}}
									/>
								}
								fileName={`Receipt-${payment.paymentNo}.pdf`}
								key={payment.id}
							>
								{({ loading }) =>
									loading ? (
										"Generating PDF..."
									) : (
										<>
											<Download className="mr-2 h-4 w-4" />
											Download receipt
										</>
									)
								}
							</PDFDownloadLink>
						</Button>
					)}
					{showUpgradeButton && (
						<PermissionGate permission="receipts:top-up">
							<Button asChild>
								<Link to="/app/receipts/$receiptId/upgrade" params={{ receiptId: payment.id }}>
									<ArrowUpCircle className="mr-2 h-4 w-4" />
									Upgrade membership
								</Link>
							</Button>
						</PermissionGate>
					)}
					{/* <Button variant="outline" size="sm">
						<Download className="mr-2 h-4 w-4" />
						Download receipt
					</Button> */}
					{/* <Button
						variant="default"
						size="sm"
						className="bg-green-600 hover:bg-green-700 text-white"
					>
						Issue refund
					</Button> */}
				</div>
			</div>

			{payment.status === "voided" && (
				<CustomAlert
					variant="destructive"
					title="Receipt voided"
					description={
						<div className="space-y-1">
							<p>
								Voided{" "}
								{payment.voidedAt ? format(new Date(payment.voidedAt), "MMM d, yyyy 'at' p") : ""}
								{payment.voidedByUser?.name ? ` by ${payment.voidedByUser.name}` : ""}.
							</p>
							{payment.voidReason && (
								<p className="text-muted-foreground">Reason: {payment.voidReason}</p>
							)}
						</div>
					}
				/>
			)}

			{upgradeInfo?.role === "original" && (
				<CustomAlert
					title="Upgraded"
					description={
						<span>
							Upgraded on {dateFormat(upgradeInfo.upgradeDate, "long")} to {upgradeInfo.newPlanName}{" "}
							—{" "}
							<Link
								to="/app/receipts/$receiptId/details"
								params={{ receiptId: upgradeInfo.linkedPaymentId }}
								className="underline"
							>
								see receipt #{linkedReceiptNo || upgradeInfo.linkedPaymentNo}
							</Link>
						</span>
					}
				/>
			)}

			{upgradeInfo?.role === "upgrade" && (
				<CustomAlert
					title="Top-up upgrade"
					description={
						<span>
							Top-up upgrade from {upgradeInfo.originalPlanName} (
							<Link
								to="/app/receipts/$receiptId/details"
								params={{ receiptId: upgradeInfo.linkedPaymentId }}
								className="underline"
							>
								receipt #{linkedReceiptNo || upgradeInfo.linkedPaymentNo}
							</Link>
							) — extended{" "}
							{upgradeInfo.originalEndDate ? dateFormat(upgradeInfo.originalEndDate, "long") : "—"}{" "}
							→ {upgradeInfo.newEndDate ? dateFormat(upgradeInfo.newEndDate, "long") : "—"}
						</span>
					}
				/>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div className="space-y-1">
								<CardTitle>Payment summary</CardTitle>
								<CardDescription>
									{isLoadingReceiptNo ? (
										<Skeleton className="h-4 w-24" />
									) : (
										`Payment # ${receiptNo}`
									)}
								</CardDescription>
							</div>
							<Badge variant={statusBadgeVariant} className="capitalize">
								{payment.status === "completed" ? "Paid" : payment.status}
							</Badge>
						</CardHeader>
						<CardContent className="pt-6">
							<div className="mb-6">
								<div className="flex items-baseline gap-2">
									<span className="text-3xl font-bold">{formattedAmount}</span>
									<span className="text-muted-foreground">One-time charge</span>
								</div>
							</div>

							<div className="grid grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">
										{coveredMembers.length > 1 ? "Members" : "Member"}
									</p>
									{coveredMembers.map((member) => (
										<p className="font-semibold" key={member.memberNo}>
											{member.firstName} {member.lastName}{" "}
											<span className="text-muted-foreground text-xs font-normal">
												(ID: {member.memberNo || "N/A"})
											</span>
										</p>
									))}
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">Payment method</p>
									<p className="font-semibold capitalize">{payment.method.replace(/_/g, " ")}</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">Payment date</p>
									<p className="font-semibold">
										{format(new Date(payment.paymentDate), "MMM d, yyyy")}
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">Status</p>
									<Badge variant="outline" className="text-green-600 border-green-600 capitalize">
										{payment.status}
									</Badge>
								</div>
								{payment.membership && (
									<div className="space-y-1">
										<p className="font-medium text-muted-foreground">Billing period</p>
										<p className="font-semibold">
											{format(new Date(payment.membership.startDate), "MMM d")} -{" "}
											{payment.membership.endDate
												? format(new Date(payment.membership.endDate), "MMM d, yyyy")
												: "Ongoing"}
										</p>
									</div>
								)}
								{payment.user && (
									<div className="space-y-1">
										<p className="font-medium text-muted-foreground">Initiated By</p>
										<p className="font-semibold capitalize">{payment.user.name}</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Line items</CardTitle>
							<CardDescription>Breakdown of what this payment covers.</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="grid grid-cols-12 text-sm font-medium text-muted-foreground pb-2 border-b">
									<div className="col-span-6">Description</div>
									<div className="col-span-2">Qty</div>
									<div className="col-span-2">Unit price</div>
									<div className="col-span-2 text-right">Amount</div>
								</div>
								<div className="grid grid-cols-12 text-sm items-center py-2 border-b">
									<div className="col-span-6">
										<p className="font-medium">Membership fee</p>
										{payment.plan && (
											<p className="text-muted-foreground text-xs">{payment.plan.name}</p>
										)}
									</div>
									<div className="col-span-2">{periods}</div>
									<div className="col-span-2">{unitPrice}</div>
									<div className="col-span-2 text-right">{subTotal}</div>
								</div>
								{addonLines.map((line) => (
									<div
										key={line.id}
										className="grid grid-cols-12 text-sm items-center py-2 border-b"
									>
										<div className="col-span-6">
											<p className="font-medium">{line.addonName}</p>
											<p className="text-muted-foreground text-xs">
												Addon{line.perMember ? ` · per member × ${line.numberOfMembers}` : ""}
											</p>
										</div>
										<div className="col-span-2">{line.numberOfPeriods}</div>
										<div className="col-span-2">
											{currencyFormatter.format(Number(line.unitAmount))}
										</div>
										<div className="col-span-2 text-right">
											{currencyFormatter.format(Number(line.lineTotal))}
										</div>
									</div>
								))}
								{/* Totals */}
								<div className="space-y-2 pt-4">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Subtotal</span>
										<span>{combinedSubtotal}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Discount:</span>
										<span>{discountedAmount}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Tax</span>
										<span>{taxAmount}</span>
									</div>
									<div className="flex justify-between font-bold text-base pt-2">
										<span>Total paid</span>
										<span>{formattedAmount}</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Activity timeline</CardTitle>
							<CardDescription>Key events related to this payment.</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6 relative pl-4 border-l">
								<div className="relative">
									<div className="absolute left-[-21px] top-1 h-3 w-3 rounded-full bg-slate-200" />
									<h4 className="text-sm font-medium">Payment Captured</h4>
									<p className="text-xs text-muted-foreground">
										{format(new Date(payment.paymentDate), "MMM d")}
									</p>
								</div>
								{payment.membership?.startDate && (
									<div className="relative">
										<div className="absolute left-[-21px] top-1 h-3 w-3 rounded-full bg-slate-200" />
										<div className="flex items-center gap-2">
											<RefreshCcw className="h-3 w-3 text-muted-foreground" />
											<h4 className="text-sm font-medium">Membership renewed</h4>
										</div>
										<p className="text-xs text-muted-foreground">
											{payment.plan?.name} - Period:{" "}
											{format(new Date(payment.membership.startDate), "MMM d")} -{" "}
											{payment.membership.endDate
												? format(new Date(payment.membership.endDate), "MMM d, yyyy")
												: "Ongoing"}
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Linked membership plan</CardTitle>
							<CardDescription>Plan this payment was applied to.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{payment.plan && (
								<div>
									<div className="flex justify-between items-start mb-1">
										<h3 className="font-semibold">{payment.plan.name}</h3>
									</div>
									<p className="text-sm text-muted-foreground">Ongoing • Monthly</p>
								</div>
							)}

							<div className="grid grid-cols-2 gap-4 text-sm">
								{payment.membership && (
									<>
										<div>
											<p className="text-muted-foreground font-medium text-xs">Contract term</p>
											<p>Month-to-month</p>
										</div>
										<div>
											<p className="text-muted-foreground font-medium text-xs">Next renewal</p>
											<p>
												{payment.membership.endDate
													? format(new Date(payment.membership.endDate), "MMM d, yyyy")
													: "N/A"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground font-medium text-xs">Payment Reference</p>
											<p>{payment.reference}</p>
										</div>
										<div>
											<p className="text-muted-foreground font-medium text-xs">Current status</p>
											<Badge variant="success" className="capitalize">
												{payment.membership.status || "Active"}
											</Badge>
										</div>
									</>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Notes */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-base">Notes</CardTitle>
							{/* <Button variant="ghost" size="icon" className="h-8 w-8">
								<Edit className="h-4 w-4" />
							</Button> */}
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								{payment.notes || "No notes available."}
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

export function PaymentDetailsSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header Skeleton */}
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="h-9 w-32" />
					{/* <Skeleton className="h-9 w-32" /> */}
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Main Column */}
				<div className="lg:col-span-2 space-y-6">
					{/* Payment Summary Skeleton */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div className="space-y-2">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-4 w-48" />
							</div>
							<Skeleton className="h-6 w-16" />
						</CardHeader>
						<CardContent className="pt-6">
							<div className="mb-6">
								<div className="flex items-baseline gap-2">
									<Skeleton className="h-9 w-32" />
									<Skeleton className="h-4 w-24" />
								</div>
							</div>

							<div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
								{[1, 2, 3, 4, 5].map((i) => (
									<div key={i} className="space-y-2">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-5 w-32" />
										{i === 1 && <Skeleton className="h-3 w-24" />}
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Line Items Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-24 mb-2" />
							<Skeleton className="h-4 w-48" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="grid grid-cols-12 pb-2 border-b">
									<div className="col-span-6">
										<Skeleton className="h-4 w-24" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-4 w-8" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-4 w-16" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-4 w-16 ml-auto" />
									</div>
								</div>
								<div className="grid grid-cols-12 py-2 border-b items-center">
									<div className="col-span-6 space-y-1">
										<Skeleton className="h-5 w-32" />
										<Skeleton className="h-3 w-24" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-4 w-4" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-4 w-16" />
									</div>
									<div className="col-span-2">
										<Skeleton className="h-4 w-16 ml-auto" />
									</div>
								</div>
								<div className="space-y-2 pt-4">
									<div className="flex justify-between">
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-4 w-16" />
									</div>
									<div className="flex justify-between">
										<Skeleton className="h-4 w-16" />
										<Skeleton className="h-4 w-16" />
									</div>
									<div className="flex justify-between pt-2">
										<Skeleton className="h-5 w-24" />
										<Skeleton className="h-5 w-24" />
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Timeline Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-32 mb-2" />
							<Skeleton className="h-4 w-48" />
						</CardHeader>
						<CardContent>
							<div className="space-y-6 pl-4 border-l">
								{[1, 2].map((i) => (
									<div key={i} className="space-y-1">
										<Skeleton className="h-4 w-32" />
										<Skeleton className="h-3 w-48" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Sidebar Column */}
				<div className="space-y-6">
					{/* Linked Membership Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-6 w-40 mb-2" />
							<Skeleton className="h-4 w-56" />
						</CardHeader>
						<CardContent className="space-y-6">
							<div>
								<div className="flex justify-between mb-2">
									<Skeleton className="h-5 w-32" />
								</div>
								<Skeleton className="h-4 w-40" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								{[1, 2, 3, 4].map((i) => (
									<div key={i} className="space-y-1">
										<Skeleton className="h-3 w-20" />
										<Skeleton className="h-4 w-24" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Notes Skeleton */}
					<Card>
						<CardHeader>
							<Skeleton className="h-5 w-16" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3 mt-2" />
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
