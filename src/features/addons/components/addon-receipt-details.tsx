import { PDFDownloadLink } from "@react-pdf/renderer";
import { getRouteApi } from "@tanstack/react-router";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GymReceiptPdf } from "@/features/receipts/components/donwloadable-receipt";

const route = getRouteApi("/app/receipts/addons/$addonInvoiceId/details");

export function AddonReceiptDetails() {
	const invoice = route.useLoaderData();

	const currencyFormatter = new Intl.NumberFormat("en-KE", {
		style: "currency",
		currency: "KES",
	});

	const subtotal = currencyFormatter.format(Number(invoice.subtotalAmount));
	const total = currencyFormatter.format(Number(invoice.totalAmount));
	const memberName = invoice.member
		? `${invoice.member.firstName} ${invoice.member.lastName}`
		: "—";

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">
						Addon receipt details
					</h1>
					<p className="text-muted-foreground">
						Standalone addon payment — no membership plan attached.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button asChild variant="outline">
						<PDFDownloadLink
							document={
								<GymReceiptPdf
									data={{
										receiptNo: invoice.invoiceNo,
										date: format(new Date(invoice.paymentDate), "MMM d, yyyy"),
										members: [
											{
												name: memberName,
												id: invoice.member?.memberNo?.toString() ?? "",
												address: "",
											},
										],
										paymentMethod: invoice.method
											.replace("_", " ")
											.toUpperCase(),
										lineItems: invoice.lines.map((line) => ({
											description: `${line.addonName}${line.perMember ? ` (per member × ${line.numberOfMembers})` : ""}`,
											qty: line.numberOfPeriods,
											price: Number(line.unitAmount),
											amount: Number(line.lineTotal),
										})),
										subtotal: Number(invoice.subtotalAmount),
										discount: 0,
										tax: Number(invoice.taxAmount),
										total: Number(invoice.totalAmount),
									}}
								/>
							}
							fileName={`Addon-Receipt-${invoice.invoiceNo}.pdf`}
							key={invoice.id}
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
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div className="space-y-1">
								<CardTitle>Payment summary</CardTitle>
								<CardDescription>Invoice # {invoice.invoiceNo}</CardDescription>
							</div>
							<Badge
								variant={
									invoice.status === "completed" ? "success" : "secondary"
								}
							>
								{invoice.status === "completed" ? "Paid" : invoice.status}
							</Badge>
						</CardHeader>
						<CardContent className="pt-6">
							<div className="mb-6">
								<div className="flex items-baseline gap-2">
									<span className="text-3xl font-bold">{total}</span>
									<span className="text-muted-foreground">Addon charge</span>
								</div>
							</div>

							<div className="grid grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">Member</p>
									<p className="font-semibold">
										{memberName}{" "}
										<span className="text-muted-foreground text-xs font-normal">
											(ID: {invoice.member?.memberNo || "N/A"})
										</span>
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">
										Payment method
									</p>
									<p className="font-semibold capitalize">
										{invoice.method.replace(/_/g, " ")}
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">
										Payment date
									</p>
									<p className="font-semibold">
										{format(new Date(invoice.paymentDate), "MMM d, yyyy")}
									</p>
								</div>
								{invoice.reference && (
									<div className="space-y-1">
										<p className="font-medium text-muted-foreground">
											Reference
										</p>
										<p className="font-semibold">{invoice.reference}</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Addons</CardTitle>
							<CardDescription>Items covered by this payment.</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="grid grid-cols-12 text-sm font-medium text-muted-foreground pb-2 border-b">
									<div className="col-span-6">Addon</div>
									<div className="col-span-2">Periods</div>
									<div className="col-span-2">Rate</div>
									<div className="col-span-2 text-right">Line total</div>
								</div>
								{invoice.lines.map((line) => (
									<div
										key={line.id}
										className="grid grid-cols-12 text-sm items-center py-2 border-b"
									>
										<div className="col-span-6">
											<p className="font-medium">{line.addonName}</p>
											{line.perMember && (
												<p className="text-muted-foreground text-xs">
													Per member × {line.numberOfMembers}
												</p>
											)}
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
								<div className="space-y-2 pt-4">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Subtotal</span>
										<span>{subtotal}</span>
									</div>
									<div className="flex justify-between font-bold text-base pt-2">
										<span>Total paid</span>
										<span>{total}</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-6">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-base">Notes</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								{invoice.notes || "No notes available."}
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

export function AddonReceiptDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-4 w-72" />
				</div>
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-56 w-full" />
				</div>
				<Skeleton className="h-32 w-full" />
			</div>
		</div>
	);
}
