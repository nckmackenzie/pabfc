import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { SalaryAdvanceStatementPdf } from "@/features/reports/components/downloadable-salary-advance-statement";
import { formatSalaryAdvanceStatus } from "@/features/reports/lib/salary-advance-report";
import { getSalaryAdvanceStatement } from "@/features/reports/services/salary-advance-report.api";
import { getSalaryAdvanceStatusVariant } from "@/features/payroll/lib/salary-advance-options";
import { currencyFormatter, dateFormat } from "@/lib/helpers";

function monthLabel(month: number | null, year: number | null) {
	if (!month || !year) return "-";
	return `${month.toString().padStart(2, "0")}/${year}`;
}

function InfoItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
			<p className="font-semibold">{value}</p>
		</div>
	);
}

export function SalaryAdvanceStatementSheet({ advanceId }: { advanceId: string }) {
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "salary-advances", "statement", advanceId],
		queryFn: () => getSalaryAdvanceStatement({ data: { advanceId } }),
		staleTime: 0,
	});

	return (
		<div className="space-y-6 px-4">
			<div className="flex justify-end no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={<SalaryAdvanceStatementPdf data={data} />}
						fileName={`salary-advance-statement-${data.header.advanceReference}.pdf`}
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
					<InfoItem label="Advance Reference" value={data.header.advanceReference} />
					<InfoItem
						label="Application Date"
						value={dateFormat(data.header.applicationDate, "long")}
					/>
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
						label="Approved Amount"
						value={currencyFormatter(data.header.approvedAmount, false)}
					/>
					<InfoItem
						label="Monthly Recovery Amount"
						value={currencyFormatter(data.header.monthlyRecoveryAmount, false)}
					/>
					<InfoItem
						label="Recovery Start"
						value={monthLabel(data.header.recoveryStartMonth, data.header.recoveryStartYear)}
					/>
					<InfoItem
						label="Approved Recovery Months"
						value={String(data.header.approvedRecoveryMonths)}
					/>
					<div className="space-y-1">
						<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							Status
						</p>
						<Badge
							variant={getSalaryAdvanceStatusVariant(data.header.status) ?? "secondary"}
							className="capitalize"
						>
							{formatSalaryAdvanceStatus(data.header.status)}
						</Badge>
					</div>
				</div>
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-semibold">Recovery History</h3>
				<div className="rounded-lg border overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>#</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Period</TableHead>
								<TableHead className="text-right">Recovery Amount (KES)</TableHead>
								<TableHead className="text-right">Balance Before (KES)</TableHead>
								<TableHead className="text-right">Balance After (KES)</TableHead>
								<TableHead>Final Recovery</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.rows.map((row) => (
								<TableRow key={`${row.index}-${row.date}`}>
									<TableCell>{row.index}</TableCell>
									<TableCell>{dateFormat(row.date, "reporting")}</TableCell>
									<TableCell>{monthLabel(row.periodMonth, row.periodYear)}</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.amount, false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.balanceBefore, false)}
									</TableCell>
									<TableCell className="text-right">
										{currencyFormatter(row.balanceAfter, false)}
									</TableCell>
									<TableCell>
										<Badge
											variant={row.isLastRecovery ? "success" : "secondary"}
											className="capitalize"
										>
											{row.isLastRecovery ? "Yes" : "No"}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</section>

			<section className="rounded-lg border bg-card p-4">
				<h3 className="text-sm font-semibold mb-3">Current Position</h3>
				<div className="grid gap-4 text-sm md:grid-cols-3 xl:grid-cols-5">
					<InfoItem
						label="Outstanding Balance"
						value={currencyFormatter(data.currentPosition.outstandingBalance, false)}
					/>
					<InfoItem
						label="Recoveries Processed"
						value={String(data.currentPosition.recoveriesProcessed)}
					/>
					<InfoItem
						label="Recoveries Remaining"
						value={String(data.currentPosition.recoveriesRemaining)}
					/>
					<InfoItem
						label="Total Recovered"
						value={currencyFormatter(data.currentPosition.totalRecovered, false)}
					/>
					<div className="space-y-1">
						<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							Status
						</p>
						<Badge
							variant={getSalaryAdvanceStatusVariant(data.currentPosition.status) ?? "secondary"}
							className="capitalize"
						>
							{formatSalaryAdvanceStatus(data.currentPosition.status)}
						</Badge>
					</div>
				</div>
			</section>
		</div>
	);
}
