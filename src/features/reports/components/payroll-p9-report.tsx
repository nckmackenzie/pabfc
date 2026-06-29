import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { AlertTriangleIcon, DownloadIcon } from "lucide-react";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { PayrollP9Pdf } from "@/features/reports/components/downloadable-payroll-p9";
import { getPayrollP9Report } from "@/features/reports/services/payroll-p9.api";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";

const route = getRouteApi("/app/reports/payroll/p9/");

function fmt(value: number | null) {
	return value === null ? "-" : currencyFormatter(value, false);
}

function fmtTotal(value: number) {
	return currencyFormatter(value, false);
}

export function PayrollP9Report() {
	const { filters } = useFilters(route.id);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "payroll-p9", filters],
		queryFn: () =>
			getPayrollP9Report({
				data: {
					employeeId: filters.employeeId ?? "",
					taxYear: Number(filters.taxYear ?? 0),
				},
			}),
		staleTime: 0,
	});

	const hasOpenMonths = data.monthsWithClosedPeriods < 12;
	const hasBlankClosedMonths = data.monthsWithPayrollActivity < data.monthsWithClosedPeriods;

	return (
		<div className="space-y-6">
			<div className="flex justify-end no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={<PayrollP9Pdf data={data} />}
						fileName={`p9-${data.employee.employeeNo}-${data.taxYear}.pdf`}
					>
						{({ loading }) =>
							loading ? (
								"Generating PDF..."
							) : (
								<>
									<DownloadIcon className="h-4 w-4 mr-2" />
									Export PDF
								</>
							)
						}
					</PDFDownloadLink>
				</Button>
			</div>

			{(hasOpenMonths || hasBlankClosedMonths) && (
				<Alert variant="warning" appearance="light">
					<AlertTriangleIcon className="size-4" />
					<AlertContent>
						<AlertTitle>Some months are intentionally blank</AlertTitle>
						<AlertDescription>
							<p>
								{hasOpenMonths
									? `${data.monthsWithClosedPeriods} of 12 months are closed for ${data.taxYear}. Remaining months stay blank until payroll is closed.`
									: null}
							</p>
							<p>
								{hasBlankClosedMonths
									? `${data.monthsWithClosedPeriods - data.monthsWithPayrollActivity} closed month(s) had no payroll slip for this employee and are shown blank.`
									: null}
							</p>
						</AlertDescription>
					</AlertContent>
				</Alert>
			)}

			{/* Employer / Employee info matching P9A form layout */}
			<div className="rounded-lg border bg-card p-4 grid gap-2 text-sm">
				<div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1 items-baseline">
					<span className="text-muted-foreground font-medium">Employer's Name</span>
					<span className="font-semibold border-b border-dashed">
						Prime Age Beauty &amp; Fitness Center
					</span>
					<span className="text-muted-foreground font-medium">Employer's PIN</span>
					<span className="text-muted-foreground italic border-b border-dashed">P051457619H</span>

					<span className="text-muted-foreground font-medium">Employee's Main Name</span>
					<span className="font-semibold border-b border-dashed">{data.employee.lastName}</span>
					<span className="text-muted-foreground font-medium">Employee's PIN</span>
					<span className="font-semibold border-b border-dashed">
						{data.employee.kraPin ?? "—"}
					</span>

					<span className="text-muted-foreground font-medium">Employee's Other Names</span>
					<span className="font-semibold border-b border-dashed">{data.employee.firstName}</span>
					<span className="text-muted-foreground font-medium" />
					<span />
				</div>
			</div>

			<div className="rounded-lg border bg-card overflow-x-auto">
				<Table className="text-xs whitespace-nowrap">
					<TableHeader>
						{/* Row 1 — column letter labels */}
						<TableRow className="border-b-0">
							<TableHead rowSpan={3} className="border-r align-bottom font-semibold">
								Month
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								A
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								B
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								C
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								D
							</TableHead>
							{/* E spans 3 sub-columns */}
							<TableHead
								colSpan={3}
								className="text-center border-r py-1 text-[10px] text-muted-foreground"
							>
								E
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								F
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								G
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								H
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								I
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								J
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								K
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								L
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								M
							</TableHead>
							<TableHead className="text-center border-r py-1 text-[10px] text-muted-foreground">
								N
							</TableHead>
							<TableHead className="text-center py-1 text-[10px] text-muted-foreground">
								O
							</TableHead>
						</TableRow>
						{/* Row 2 — column names */}
						<TableRow className="border-b-0">
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Basic Salary
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Benefits Non‑Cash
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Value of Quarters
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Total Gross Pay
							</TableHead>
							{/* E sub-column headers */}
							<TableHead
								colSpan={3}
								className="text-center border-r py-1 leading-tight font-semibold"
							>
								Defined Contribution Retirement Scheme
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								AHL
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								SHIF
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								PRMF
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Owner‑Occupied Interest
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Total Deductions (Lower of E+F+G+H+I)
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Chargeable Pay (D−J)
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Tax Charged
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Personal Relief
							</TableHead>
							<TableHead className="text-right border-r py-1 leading-tight align-bottom">
								Insurance Relief
							</TableHead>
							<TableHead className="text-right py-1 leading-tight align-bottom">
								PAYE Tax (L−M−N)
							</TableHead>
						</TableRow>
						{/* Row 3 — E sub-labels */}
						<TableRow>
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="text-right border-r py-1 text-[10px] text-muted-foreground">
								E1 30% of A
							</TableHead>
							<TableHead className="text-right border-r py-1 text-[10px] text-muted-foreground">
								E2 Actual
							</TableHead>
							<TableHead className="text-right border-r py-1 text-[10px] text-muted-foreground">
								E3 Fixed 30,000 p.m.
							</TableHead>
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="border-r py-1" />
							<TableHead className="py-1" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.rows.map((row) => (
							<TableRow key={row.monthNumber}>
								<TableCell className="font-medium border-r">{row.month}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.basicSalary)}</TableCell>
								<TableCell className="text-right border-r text-muted-foreground">
									{fmt(row.benefitsNonCash)}
								</TableCell>
								<TableCell className="text-right border-r text-muted-foreground">
									{fmt(row.valueOfQuarters)}
								</TableCell>
								<TableCell className="text-right border-r">{fmt(row.totalGrossPay)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.e1ThirtyPctBasic)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.e2ActualPension)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.e3Fixed)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.ahlEmployee)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.shifEmployee)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.prmf)}</TableCell>
								<TableCell className="text-right border-r">
									{fmt(row.ownerOccupiedInterest)}
								</TableCell>
								<TableCell className="text-right border-r font-medium">
									{fmt(row.totalDeductions)}
								</TableCell>
								<TableCell className="text-right border-r font-medium">
									{fmt(row.chargeablePay)}
								</TableCell>
								<TableCell className="text-right border-r">{fmt(row.taxCharged)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.personalRelief)}</TableCell>
								<TableCell className="text-right border-r">{fmt(row.insuranceRelief)}</TableCell>
								<TableCell className="text-right font-medium">{fmt(row.payeTax)}</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell className="font-semibold border-r">TOTAL</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.basicSalary)}
							</TableCell>
							<TableCell className="text-right border-r text-muted-foreground">
								{fmtTotal(data.totals.benefitsNonCash)}
							</TableCell>
							<TableCell className="text-right border-r text-muted-foreground">
								{fmtTotal(data.totals.valueOfQuarters)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.totalGrossPay)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.e1ThirtyPctBasic)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.e2ActualPension)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.e3Fixed)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.ahlEmployee)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.shifEmployee)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.prmf)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.ownerOccupiedInterest)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.totalDeductions)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.chargeablePay)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.taxCharged)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.personalRelief)}
							</TableCell>
							<TableCell className="text-right border-r font-semibold">
								{fmtTotal(data.totals.insuranceRelief)}
							</TableCell>
							<TableCell className="text-right font-semibold">
								{fmtTotal(data.totals.payeTax)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</div>

			{/* End-of-year summary fields matching form footer */}
			<div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4 text-sm">
				<div>
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Total Chargeable Pay (Col. K) Kshs.
					</p>
					<p className="mt-1 text-base font-semibold">{fmtTotal(data.totals.chargeablePay)}</p>
				</div>
				<div>
					<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Total Tax (Col. O) Kshs.
					</p>
					<p className="mt-1 text-base font-semibold">{fmtTotal(data.totals.payeTax)}</p>
				</div>
			</div>
		</div>
	);
}

export function PayrollP9ReportSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<Skeleton className="h-9 w-32" />
			</div>
			<Skeleton className="h-24 rounded-lg" />
			<div className="rounded-lg border bg-card p-4 space-y-3">
				{Array.from({ length: 7 }).map((_, index) => (
					<div key={`payroll-p9-row-${index.toString()}`} className="grid grid-cols-8 gap-3">
						{Array.from({ length: 8 }).map((__, cellIndex) => (
							<Skeleton
								key={`payroll-p9-cell-${index.toString()}-${cellIndex.toString()}`}
								className="h-4"
							/>
						))}
					</div>
				))}
			</div>
			<Skeleton className="h-16 rounded-lg" />
		</div>
	);
}
