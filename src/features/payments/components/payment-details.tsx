import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Download, Edit, Printer, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { registerUrlCallacksFn } from "../services/payment.mutations.api";
import { paymentsQueries } from "../services/queries";

interface PaymentDetailsProps {
	paymentId: string;
}

export function PaymentDetails({ paymentId }: PaymentDetailsProps) {
	const { data: payment } = useSuspenseQuery(paymentsQueries.detail(paymentId));
	const { mutate, isPending } = useMutation({
		mutationFn: () => registerUrlCallacksFn(),
		onSuccess: () => {
			toast.success("Payment registered successfully");
		},
		onError: (error) => {
			console.error(error);
			toast.error("Failed to register payment");
		},
	});

	if (!payment) {
		return <div>Payment not found</div>;
	}

	const currencyFormatter = new Intl.NumberFormat("en-KE", {
		style: "currency",
		currency: payment.currency,
	});

	const formattedAmount = currencyFormatter.format(+payment.totalAmount);
	// Assuming a tax rate or calculation, or just using 0 if not available
	const taxAmount = currencyFormatter.format(+payment.taxAmount);
	const subTotal = currencyFormatter.format(+payment.amount);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Link
							to="/app/payments"
							className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to payments
						</Link>
					</div>
					<h1 className="text-2xl font-bold tracking-tight">Payment details</h1>
					<p className="text-muted-foreground">
						Review transaction information and linked membership plan.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => mutate()}
						disabled={isPending}
					>
						<Printer className="mr-2 h-4 w-4" />
						Print receipt
					</Button>
					<Button variant="outline" size="sm">
						<Download className="mr-2 h-4 w-4" />
						Download invoice
					</Button>
					<Button
						variant="default"
						size="sm"
						className="bg-green-600 hover:bg-green-700 text-white"
					>
						{/* Using green to match mockup "Issue refund" button style if desired, though usually destructive/warning. Mockup shows green 'Issue refund' which is odd, usually refund is red/neutral. Mockup actually shows 'Issue refund' as green. I will stick to variant outline or destruct for refund normally, but let's follow mockup color loosely or standard UI. Mockup: Green 'Issue refund' button. */}
						Issue refund
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Main Column (2/3) */}
				<div className="lg:col-span-2 space-y-6">
					{/* Payment Summary */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<div className="space-y-1">
								<CardTitle>Payment summary</CardTitle>
								<CardDescription>
									Invoice #
									{payment.externalReference ||
										payment.reference ||
										payment.paymentNo}{" "}
									- Created{" "}
									{format(new Date(payment.paymentDate), "MMM d, yyyy")}
								</CardDescription>
							</div>
							<Badge
								variant={
									payment.status === "completed" ? "default" : "secondary"
								}
								className={
									payment.status === "completed"
										? "bg-green-600 hover:bg-green-700"
										: ""
								}
							>
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
									<p className="font-medium text-muted-foreground">Member</p>
									<p className="font-semibold">
										{payment.member.firstName} {payment.member.lastName}
									</p>
									<p className="text-muted-foreground text-xs">
										Member ID: {payment.member.memberNo || "N/A"}
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">
										Payment method
									</p>
									<p className="font-semibold capitalize">
										{payment.method.replace(/_/g, " ")}
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">
										Payment date
									</p>
									<p className="font-semibold">
										{format(
											new Date(payment.paymentDate),
											"MMM d, yyyy - HH:mm",
										)}
									</p>
								</div>
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">Status</p>
									<Badge
										variant="outline"
										className="text-green-600 border-green-600 capitalize"
									>
										{payment.status}
									</Badge>
								</div>
								{payment.membership && (
									<div className="space-y-1">
										<p className="font-medium text-muted-foreground">
											Billing period
										</p>
										<p className="font-semibold">
											{format(new Date(payment.membership.startDate), "MMM d")}{" "}
											-{" "}
											{payment.membership.endDate
												? format(
														new Date(payment.membership.endDate),
														"MMM d, yyyy",
													)
												: "Ongoing"}
										</p>
									</div>
								)}
								<div className="space-y-1">
									<p className="font-medium text-muted-foreground">Location</p>
									<p className="font-semibold">Downtown Studio</p>{" "}
									{/* Hardcoded as requested */}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Line Items */}
					<Card>
						<CardHeader>
							<CardTitle>Line items</CardTitle>
							<CardDescription>
								Breakdown of what this payment covers.
							</CardDescription>
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
										<p className="font-medium">Monthly membership fee</p>
										{payment.plan && (
											<p className="text-muted-foreground text-xs">
												{payment.plan.name}
											</p>
										)}
									</div>
									<div className="col-span-2">1</div>
									<div className="col-span-2">{subTotal}</div>
									<div className="col-span-2 text-right">{subTotal}</div>
								</div>
								{/* Totals */}
								<div className="space-y-2 pt-4">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Subtotal</span>
										<span>{subTotal}</span>
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

					{/* Activity Timeline (Placeholder) */}
					<Card>
						<CardHeader>
							<CardTitle>Activity timeline</CardTitle>
							<CardDescription>
								Key events related to this payment.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-6 relative pl-4 border-l">
								<div className="relative">
									<div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-200" />
									<h4 className="text-sm font-medium">Payment captured</h4>
									<p className="text-xs text-muted-foreground">
										{format(new Date(payment.paymentDate), "MMM d, HH:mm")} - By
										System
									</p>
								</div>
								{payment.membership?.startDate && (
									<div className="relative">
										<div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-200" />
										<div className="flex items-center gap-2">
											<RefreshCcw className="h-3 w-3 text-muted-foreground" />
											<h4 className="text-sm font-medium">
												Membership renewed
											</h4>
										</div>
										<p className="text-xs text-muted-foreground">
											{payment.plan?.name} - Period:{" "}
											{format(new Date(payment.membership.startDate), "MMM d")}{" "}
											-{" "}
											{payment.membership.endDate
												? format(
														new Date(payment.membership.endDate),
														"MMM d, yyyy",
													)
												: "Ongoing"}
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Sidebar (1/3) */}
				<div className="space-y-6">
					{/* Linked Membership Plan */}
					<Card>
						<CardHeader>
							<CardTitle>Linked membership plan</CardTitle>
							<CardDescription>
								Plan this payment was applied to.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{payment.plan && (
								<div>
									<div className="flex justify-between items-start mb-1">
										<h3 className="font-semibold">{payment.plan.name}</h3>
										<Badge variant="outline" className="text-xs">
											Primary
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">
										Ongoing • Monthly auto-renew
									</p>
								</div>
							)}

							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground font-medium text-xs">
										Plan type
									</p>
									<p>Unlimited gym + classes</p>
								</div>
								{payment.membership && (
									<>
										<div>
											<p className="text-muted-foreground font-medium text-xs">
												Contract term
											</p>
											<p>Month-to-month</p>
										</div>
										<div>
											<p className="text-muted-foreground font-medium text-xs">
												Next renewal
											</p>
											<p>
												{payment.membership.endDate
													? format(
															new Date(payment.membership.endDate),
															"MMM d, yyyy",
														)
													: "N/A"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground font-medium text-xs">
												Current status
											</p>
											<Badge className="bg-green-600 hover:bg-green-700 text-[10px] px-1.5 h-5">
												{payment.membership.status || "Active"}
											</Badge>
										</div>
									</>
								)}
							</div>

							<Separator />

							<div className="space-y-2">
								<p className="text-sm font-medium">Included access</p>
								<ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
									<li>Unlimited gym floor access</li>
									<li>Unlimited group classes</li>
									<li>4 guest passes per month</li>
								</ul>
							</div>
						</CardContent>
					</Card>

					{/* Identifiers & References */}
					<Card>
						<CardHeader>
							<CardTitle>Identifiers & references</CardTitle>
							<CardDescription>Ids for reconciliation.</CardDescription>
						</CardHeader>
						<CardContent className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground text-xs font-medium">
									Invoice ID
								</p>
								<p className="font-medium">{payment.reference || "-"}</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs font-medium">
									External reference
								</p>
								<p className="font-medium break-all">
									{payment.externalReference || "-"}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs font-medium">
									Payment source
								</p>
								<p className="font-medium">{payment.channel}</p>
							</div>
						</CardContent>
					</Card>

					{/* Notes */}
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-base">Notes</CardTitle>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<Edit className="h-4 w-4" />
							</Button>
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
