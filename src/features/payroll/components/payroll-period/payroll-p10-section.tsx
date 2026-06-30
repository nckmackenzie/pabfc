import { useQuery } from "@tanstack/react-query";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { PayrollP10Pdf } from "@/features/reports/components/downloadable-payroll-p10";
import { getPayrollP10Report } from "@/features/reports/services/payroll-p10.api";
import { currencyFormatter } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { DownloadIcon, FileSpreadsheetIcon } from "@/components/ui/icons";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ErrorComponent } from "@/components/ui/error-component";
import { isValidP10Status } from "@/features/reports/lib/payroll-p10";

type Props = {
	periodId: string;
	status: string;
	periodName: string;
};

const NUM_COLS = [
	{ key: "basicSalary", label: "Basic Salary (A)" },
	{ key: "totalGrossPay", label: "Gross Pay (D)" },
	{ key: "e1ThirtyPctBasic", label: "E1 (30% of A)" },
	{ key: "e2ActualPension", label: "E2 (Actual)" },
	{ key: "e3Fixed", label: "E3 (Fixed)" },
	{ key: "ahlEmployee", label: "AHL (F)" },
	{ key: "shifEmployee", label: "SHIF (G)" },
	{ key: "prmf", label: "PRMF (H)" },
	{ key: "ownerOccupiedInterest", label: "OOI (I)" },
	{ key: "totalDeductions", label: "Total Deductions (J)" },
	{ key: "chargeablePay", label: "Chargeable Pay (K)" },
	{ key: "taxCharged", label: "Tax Charged (L)" },
	{ key: "personalRelief", label: "Personal Relief (M)" },
	{ key: "insuranceRelief", label: "Insurance Relief (N)" },
	{ key: "payeTax", label: "PAYE Tax (O)" },
] as const;

type NumColKey = (typeof NUM_COLS)[number]["key"];

function fmt(value: number | null): string {
	if (value === null) return "—";
	return currencyFormatter(value);
}

export function PayrollP10Section({ periodId, status, periodName }: Props) {
	const isAvailable = isValidP10Status(status);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["payroll-periods", "p10", periodId],
		queryFn: () => getPayrollP10Report({ data: { payrollPeriodId: periodId } }),
		enabled: isAvailable,
	});

	return (
		<section
			className={cn("border rounded-md", {
				"cursor-not-allowed opacity-70 border-dashed": !isAvailable,
			})}
		>
			{!isAvailable ? (
				<div className="p-5">
					<p className="text-sm text-muted-foreground block text-center">
						P10 Monthly PAYE Return is available once this period is paid.
					</p>
				</div>
			) : (
				<div className="p-5 space-y-5">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
						<div className="flex items-center gap-2 flex-1">
							<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
								<FileSpreadsheetIcon className="size-4" />
							</span>
							<div>
								<h4 className="text-sm md:text-base font-semibold">P10 Monthly PAYE Return</h4>
								<p className="text-muted-foreground text-xs">
									All-employee PAYE figures for KRA iTax filing
								</p>
							</div>
						</div>
						{data && (
							<PDFDownloadLink
								document={<PayrollP10Pdf data={data} />}
								fileName={`p10-${periodName.replace(/\s+/g, "-")}.pdf`}
							>
								{({ loading }) => (
									<Button type="button" size="sm" variant="outline" disabled={loading}>
										<DownloadIcon />
										{loading ? "Preparing…" : "Download PDF"}
									</Button>
								)}
							</PDFDownloadLink>
						)}
					</div>

					{isLoading ? (
						<p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
					) : isError ? (
						<ErrorComponent message="Failed to load the P10 report. Try again later." />
					) : data && data.rows.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4">
							No active payslips found for this period.
						</p>
					) : data ? (
						<>
							{data.periodTotalPaye !== null && (
								<div
									className={cn(
										"rounded-md border px-3 py-2 text-sm",
										Math.abs(data.totals.payeTax - data.periodTotalPaye) < 0.01
											? "border-green-300 bg-green-50 text-green-900"
											: "border-amber-300 bg-amber-50 text-amber-900"
									)}
								>
									{Math.abs(data.totals.payeTax - data.periodTotalPaye) < 0.01 ? (
										<>
											P10 PAYE total <strong>{currencyFormatter(data.totals.payeTax)}</strong>{" "}
											reconciles with the period total.
										</>
									) : (
										<>
											<strong>Discrepancy:</strong> P10 PAYE total{" "}
											<strong>{currencyFormatter(data.totals.payeTax)}</strong> does not match the
											period total <strong>{currencyFormatter(data.periodTotalPaye)}</strong>.
											Review payslip data before filing.
										</>
									)}
								</div>
							)}

							{/* Table */}
							<div className="overflow-x-auto rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="whitespace-nowrap sticky left-0 bg-background z-10">
												Employee
											</TableHead>
											<TableHead className="whitespace-nowrap">KRA PIN</TableHead>
											{NUM_COLS.map((col) => (
												<TableHead key={col.key} className="text-right whitespace-nowrap">
													{col.label}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.rows.map((row) => (
											<TableRow key={row.employeeNo}>
												<TableCell className="sticky left-0 bg-background z-10">
													<p className="font-medium whitespace-nowrap">{row.employeeName}</p>
													<p className="text-xs text-muted-foreground">{row.employeeNo}</p>
												</TableCell>
												<TableCell className="text-xs text-muted-foreground whitespace-nowrap">
													{row.kraPin ?? "—"}
												</TableCell>
												{NUM_COLS.map((col) => (
													<TableCell
														key={col.key}
														className="text-right whitespace-nowrap tabular-nums"
													>
														{fmt(row[col.key as NumColKey] as number | null)}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{/* Totals bar */}
							<div className="rounded-md border bg-muted/40 px-4 py-3">
								<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
									<div>
										<p className="text-xs text-muted-foreground">Total Gross Pay</p>
										<p className="font-semibold tabular-nums">
											{currencyFormatter(data.totals.totalGrossPay)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">Total Chargeable Pay</p>
										<p className="font-semibold tabular-nums">
											{currencyFormatter(data.totals.chargeablePay)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">Total Tax Charged</p>
										<p className="font-semibold tabular-nums">
											{currencyFormatter(data.totals.taxCharged)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">Total Relief</p>
										<p className="font-semibold tabular-nums">
											{currencyFormatter(data.totals.personalRelief + data.totals.insuranceRelief)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground font-medium">Total PAYE Tax</p>
										<p className="text-lg font-bold tabular-nums">
											{currencyFormatter(data.totals.payeTax)}
										</p>
									</div>
								</div>
							</div>
						</>
					) : null}
				</div>
			)}
		</section>
	);
}
