import { PDFDownloadLink } from "@react-pdf/renderer";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DownloadIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { MemberInfo } from "@/features/members/components/member-profile";
import { PaymentPdf } from "@/features/payments/components/downloadable-payment";
import type { getPayment } from "@/features/payments/services/payments.api";
import { currencyFormatter } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function PaymentDetails({
	payment,
}: {
	payment: Awaited<ReturnType<typeof getPayment>>;
}) {
	const totalPaid = payment.lines.reduce(
		(acc, line) => acc + parseFloat(line.amount),
		0,
	);

	return (
		<div className="space-y-6">
			<PageHeader
				title="Payment Details"
				description={`Payment #${payment.paymentNo} details`}
				content={
					<Button asChild variant="outline" size="sm">
						<PDFDownloadLink
							document={
								<PaymentPdf
									data={{
										paymentNo: payment.paymentNo,
										paymentDate: format(
											new Date(payment.paymentDate),
											"dd/MM/yyyy",
										),
										vendor: toTitleCase(payment.vendor.name),
										paymentMethod: payment.paymentMethod,
										reference: payment.reference ?? undefined,
										bank: payment.bank?.bankName
											? toTitleCase(payment.bank.bankName)
											: undefined,
										memo: payment.memo ?? undefined,
										lines: payment.lines.map((line) => ({
											billNo: line.bill.invoiceNo,
											billDate: format(
												new Date(line.bill.invoiceDate),
												"dd/MM/yyyy",
											),
											dueDate: line.bill.dueDate
												? format(new Date(line.bill.dueDate), "dd/MM/yyyy")
												: undefined,
											billAmount: currencyFormatter(
												parseFloat(line.bill.total),
												false,
											),
											balance: currencyFormatter(
												parseFloat(line.currentBalance),
												false,
											),
											amountPaid: currencyFormatter(
												parseFloat(line.amount),
												false,
											),
										})),
										totalPaid: currencyFormatter(totalPaid),
									}}
								/>
							}
							fileName={`Payment-${payment.paymentNo}.pdf`}
							key={Date.now()}
						>
							{({ loading }) =>
								loading ? (
									"Generating PDF..."
								) : (
									<>
										<DownloadIcon className="h-4 w-4" />
										Export PDF
									</>
								)
							}
						</PDFDownloadLink>
					</Button>
				}
			/>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Payment Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					<MemberInfo label="Payment No" value={payment.paymentNo.toString()} />
					<MemberInfo
						label="Payment Date"
						value={format(new Date(payment.paymentDate), "dd/MM/yyyy")}
					/>
					<MemberInfo label="Vendor" value={toTitleCase(payment.vendor.name)} />
					<MemberInfo
						label="Created On"
						value={format(new Date(payment.createdAt), "dd/MM/yyyy")}
					/>
					<MemberInfo label="Payment Method" value={payment.paymentMethod} />
					<MemberInfo
						label="Reference"
						value={payment.reference?.toUpperCase()}
					/>
					<MemberInfo
						label="Bank"
						value={
							payment.bank?.bankName ? toTitleCase(payment.bank.bankName) : "-"
						}
					/>
					<MemberInfo
						label="Amount Paid"
						value={currencyFormatter(
							payment.lines.reduce(
								(acc, line) => acc + parseFloat(line.amount),
								0,
							),
						)}
					/>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Allocated Bills</CardTitle>
					<CardDescription>
						Each bill and amount affected by this payment
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Bill #</TableHead>
								<TableHead>Bill Date</TableHead>
								<TableHead>Due Date</TableHead>
								<TableHead className="text-right">Amount</TableHead>
								<TableHead className="text-right">Balance</TableHead>
								<TableHead className="text-right">Amount Paid</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{payment.lines.map((line) => (
								<TableRow key={line.id}>
									<TableCell>{line.bill.invoiceNo}</TableCell>
									<TableCell>
										{format(new Date(line.bill.invoiceDate), "dd/MM/yyyy")}
									</TableCell>
									<TableCell>
										{line.bill.dueDate
											? format(new Date(line.bill.dueDate), "dd/MM/yyyy")
											: "-"}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(parseFloat(line.bill.total), false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(parseFloat(line.currentBalance), false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(parseFloat(line.amount), false)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader className="pb-0">
					<CardTitle>Notes</CardTitle>
					<CardDescription>{toTitleCase(payment.memo || "-")}</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}

export function PaymentDetailsSkeleton() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Payment Details"
				description="Loading payment details..."
				content={<Skeleton className="h-9 w-24" />}
			/>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Payment Information</CardTitle>
				</CardHeader>
				<CardContent className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 md:gap-x-12">
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
							key={i}
							className="space-y-2"
						>
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-32" />
						</div>
					))}
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader>
					<CardTitle>Allocated Bills</CardTitle>
					<CardDescription>
						Each bill and amount affected by this payment
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Bill #</TableHead>
								<TableHead>Bill Date</TableHead>
								<TableHead>Due Date</TableHead>
								<TableHead className="text-right">Amount</TableHead>
								<TableHead className="text-right">Balance</TableHead>
								<TableHead className="text-right">Amount Paid</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.from({ length: 3 }).map((_, i) => (
								<TableRow
									// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
									key={i}
								>
									<TableCell>
										<Skeleton className="h-4 w-20" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell className="text-right">
										<Skeleton className="ml-auto h-4 w-20" />
									</TableCell>
									<TableCell className="text-right">
										<Skeleton className="ml-auto h-4 w-20" />
									</TableCell>
									<TableCell className="text-right">
										<Skeleton className="ml-auto h-4 w-20" />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
			<Card className="shadow-none">
				<CardHeader className="pb-0">
					<CardTitle>Notes</CardTitle>
					<Skeleton className="h-4 w-48" />
				</CardHeader>
			</Card>
		</div>
	);
}
