import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatText } from "@/features/employees/utils/helpers";
import { LoanStatementPdf } from "@/features/reports/components/downloadable-loan-statement";
import { getLoanStatement } from "@/features/reports/services/loan-ledger-report.api";
import { getLoanStatusVariant } from "@/features/payroll/lib/loan-options";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

function monthLabel(month: number | null, year: number | null) {
	if (!month || !year) return "-";
	return `${month.toString().padStart(2, "0")}/${year}`;
}

function interestRateLabel(rate: number) {
	if (rate === 0) return "Interest-free";
	return `${(rate * 100).toFixed(2)}%`;
}

function InfoItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
			<p className="font-semibold">{value}</p>
		</div>
	);
}

export function LoanStatementSheet({ loanId }: { loanId: string }) {
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "loan-ledger", "statement", loanId],
		queryFn: () => getLoanStatement({ data: { loanId } }),
		staleTime: 0,
	});

	return (
		<div className="space-y-6 px-4 overflow-x-auto">
			<div className="flex justify-end no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={<LoanStatementPdf data={data} />}
						fileName={`loan-statement-${data.header.loanReference}.pdf`}
					>
						{({ loading }) =>
							loading ? (
								"Generating PDF..."
							) : (
								<>
									<DownloadIcon className="h-4 w-4 mr-2" />
									Download PDF
								</>
							)
						}
					</PDFDownloadLink>
				</Button>
			</div>

			<section className="rounded-lg border bg-card p-4">
				<h3 className="text-sm font-semibold mb-3">Header</h3>
				<div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
					<InfoItem label="Employee Name" value={data.header.employeeName} />
					<InfoItem label="Employee No" value={data.header.employeeNo} />
					<InfoItem label="Loan Reference" value={data.header.loanReference} />
					<InfoItem
						label="Disbursement Date"
						value={
							data.header.disbursementDate ? dateFormat(data.header.disbursementDate, "long") : "-"
						}
					/>
					<InfoItem
						label="Disbursement Account"
						value={data.header.disbursementAccountName ?? "-"}
					/>
					<InfoItem
						label="Original Approved Amount"
						value={currencyFormatter(data.header.originalApprovedAmount, false)}
					/>
					<InfoItem
						label="Annual Interest Rate"
						value={interestRateLabel(data.header.annualInterestRate)}
					/>
					<InfoItem label="Approved Instalments" value={String(data.header.approvedInstalments)} />
					<InfoItem
						label="Repayment Start"
						value={monthLabel(data.header.repaymentStartMonth, data.header.repaymentStartYear)}
					/>
				</div>
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Repayment Schedule</h3>
				<div className="rounded-lg border overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Period</TableHead>
								<TableHead className="text-right">Principal Component (KES)</TableHead>
								<TableHead className="text-right">Interest Component (KES)</TableHead>
								<TableHead className="text-right">Total Payment (KES)</TableHead>
								<TableHead className="text-right">Balance Before (KES)</TableHead>
								<TableHead className="text-right">Balance After (KES)</TableHead>
								<TableHead>Type</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.rows.map((row) => (
								<TableRow key={`${row.index}-${row.date}`}>
									<TableCell>{row.index}</TableCell>
									<TableCell>{dateFormat(row.date, "reporting")}</TableCell>
									<TableCell>{monthLabel(row.periodMonth, row.periodYear)}</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.principalComponent, false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.interestComponent, false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.totalPayment, false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.balanceBefore, false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.balanceAfter, false)}
									</TableCell>
									<TableCell>
										<Badge
											variant={row.isEarlySettlement ? "warning" : "secondary"}
											className="capitalize"
										>
											{row.isEarlySettlement ? "Early settlement" : "Regular"}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
						<TableFooter>
							<TableRow>
								<TableCell colSpan={3} className="font-semibold">
									Totals
								</TableCell>
								<TableCell className="text-right font-semibold">
									{currencyFormatter(data.totals.totalPrincipalPaid, false)}
								</TableCell>
								<TableCell className="text-right font-semibold">
									{currencyFormatter(data.totals.totalInterestPaid, false)}
								</TableCell>
								<TableCell className="text-right font-semibold">
									{currencyFormatter(data.totals.totalPaid, false)}
								</TableCell>
								<TableCell colSpan={3} />
							</TableRow>
						</TableFooter>
					</Table>
				</div>
			</section>

			<section className="rounded-lg border bg-card p-4">
				<h3 className="text-sm font-semibold mb-3">Current Position</h3>
				<div className="grid gap-4 text-sm md:grid-cols-3">
					<InfoItem
						label="Outstanding Balance"
						value={currencyFormatter(data.currentPosition.outstandingBalance, false)}
					/>
					<InfoItem
						label="Instalments Remaining"
						value={String(data.currentPosition.instalmentsRemaining)}
					/>
					<div className="space-y-1">
						<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							Status
						</p>
						<Badge
							variant={getLoanStatusVariant(data.currentPosition.status) ?? "secondary"}
							className="capitalize"
						>
							{formatText(data.currentPosition.status)}
						</Badge>
					</div>
				</div>
			</section>
		</div>
	);
}
