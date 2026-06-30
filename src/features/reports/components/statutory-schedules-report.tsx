import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getStatutorySchedulesForPeriod } from "@/features/reports/services/statutory-schedules.api";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";
import { cn } from "@/lib/utils";

const route = getRouteApi("/app/reports/payroll/statutory-schedules/");

const fmtCur = (v: number) => currencyFormatter(v, false);
const THRESH = 0.01;

function ReconciliationBanner({
	computed,
	stored,
	label,
}: {
	computed: number;
	stored: number | null;
	label: string;
}) {
	if (stored === null) return null;
	const ok = Math.abs(computed - stored) < THRESH;
	return (
		<div
			className={cn(
				"flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
				ok
					? "border-green-300 bg-green-50 text-green-900"
					: "border-amber-300 bg-amber-50 text-amber-900"
			)}
		>
			{ok ? (
				<CheckCircleIcon className="mt-0.5 size-4 shrink-0" />
			) : (
				<AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
			)}
			<span>
				{ok ? (
					<>
						{label} total <strong>{fmtCur(computed)}</strong> reconciles with the period total.
					</>
				) : (
					<>
						<strong>Discrepancy ({label}):</strong> computed{" "}
						<strong>{fmtCur(computed)}</strong> differs from period stored total{" "}
						<strong>{fmtCur(stored)}</strong>. Review payslip data.
					</>
				)}
			</span>
		</div>
	);
}

type ReportData = Awaited<ReturnType<typeof getStatutorySchedulesForPeriod>>;

type NssfRow = ReportData["nssf"]["rows"][number];
type ShifRow = ReportData["shif"]["rows"][number];
type AhlRow = ReportData["ahl"]["rows"][number];
type NitaRow = { employeeCount: number; totalLevy: number };

const nssfColumns: Array<ColumnDef<NssfRow>> = [
	{ accessorKey: "employeeName", header: "Employee Name" },
	{ accessorKey: "employeeNo", header: "Employee No" },
	{ accessorKey: "nssfNo", header: "NSSF Number", cell: ({ row }) => row.original.nssfNo ?? "—" },
	{
		accessorKey: "nssfEmployee",
		header: () => <div className="text-right">Employee Contribution</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.nssfEmployee)}</div>,
	},
	{
		accessorKey: "nssfEmployer",
		header: () => <div className="text-right">Employer Contribution</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.nssfEmployer)}</div>,
	},
	{
		accessorKey: "total",
		header: () => <div className="text-right">Total</div>,
		cell: ({ row }) => <div className="text-right tabular-nums font-medium">{fmtCur(row.original.total)}</div>,
	},
];

const shifColumns: Array<ColumnDef<ShifRow>> = [
	{ accessorKey: "employeeName", header: "Employee Name" },
	{ accessorKey: "employeeNo", header: "Employee No" },
	{ accessorKey: "shifNo", header: "SHIF Number", cell: ({ row }) => row.original.shifNo ?? "—" },
	{
		accessorKey: "shifEmployee",
		header: () => <div className="text-right">Contribution Amount</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.shifEmployee)}</div>,
	},
];

const ahlColumns: Array<ColumnDef<AhlRow>> = [
	{ accessorKey: "employeeName", header: "Employee Name" },
	{ accessorKey: "employeeNo", header: "Employee No" },
	{ accessorKey: "kraPin", header: "KRA PIN", cell: ({ row }) => row.original.kraPin ?? "—" },
	{
		accessorKey: "ahlEmployee",
		header: () => <div className="text-right">Employee Contribution</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.ahlEmployee)}</div>,
	},
	{
		accessorKey: "ahlEmployer",
		header: () => <div className="text-right">Employer Contribution</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.ahlEmployer)}</div>,
	},
	{
		accessorKey: "total",
		header: () => <div className="text-right">Total</div>,
		cell: ({ row }) => <div className="text-right tabular-nums font-medium">{fmtCur(row.original.total)}</div>,
	},
];

const nitaColumns: Array<ColumnDef<NitaRow>> = [
	{
		accessorKey: "employeeCount",
		header: "Employee Count",
	},
	{
		accessorKey: "totalLevy",
		header: () => <div className="text-right">Total NITA Levy</div>,
		cell: ({ row }) => <div className="text-right tabular-nums font-medium">{fmtCur(row.original.totalLevy)}</div>,
	},
];

function SectionHeader({ title, description }: { title: string; description: string }) {
	return (
		<div className="mb-3">
			<h3 className="text-base font-semibold">{title}</h3>
			<p className="text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

export function StatutorySchedulesReport() {
	const { filters } = useFilters(route.id);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "statutory-schedules", filters.payrollPeriodId],
		queryFn: () =>
			getStatutorySchedulesForPeriod({ data: { payrollPeriodId: filters.payrollPeriodId ?? "" } }),
		staleTime: 0,
	});

	const { nssf, shif, ahl, nita, storedTotals } = data;
	const periodLabel = data.period.name;
	const nitaRows: NitaRow[] = [{ employeeCount: nita.employeeCount, totalLevy: nita.totalLevy }];

	return (
		<div className="space-y-10">
			{/* ── NSSF ── */}
			<section>
				<SectionHeader
					title="NSSF Schedule"
					description={`National Social Security Fund contributions for ${periodLabel}`}
				/>
				<div className="space-y-3">
					<ReconciliationBanner
						computed={nssf.totals.nssfEmployee}
						stored={storedTotals.nssfEmployee}
						label="NSSF Employee"
					/>
					<ReconciliationBanner
						computed={nssf.totals.nssfEmployer}
						stored={storedTotals.nssfEmployer}
						label="NSSF Employer"
					/>
					<DataTable
						columns={nssfColumns}
						data={nssf.rows}
						exportToExcel
						exportFileName={`nssf-schedule-${periodLabel}.csv`}
						withPaginationButtons={false}
						denseCell
						customFooter={
							<>
								<TableCell colSpan={3} className="font-semibold">
									Totals
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(nssf.totals.nssfEmployee)}
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(nssf.totals.nssfEmployer)}
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(nssf.totals.total)}
								</TableCell>
							</>
						}
					/>
				</div>
			</section>

			{/* ── SHIF ── */}
			<section>
				<SectionHeader
					title="SHIF Schedule"
					description={`Social Health Insurance Fund contributions for ${periodLabel}`}
				/>
				<div className="space-y-3">
					<ReconciliationBanner
						computed={shif.totals.shifEmployee}
						stored={storedTotals.shifEmployee}
						label="SHIF"
					/>
					<DataTable
						columns={shifColumns}
						data={shif.rows}
						exportToExcel
						exportFileName={`shif-schedule-${periodLabel}.csv`}
						withPaginationButtons={false}
						denseCell
						customFooter={
							<>
								<TableCell colSpan={3} className="font-semibold">
									Totals
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(shif.totals.shifEmployee)}
								</TableCell>
							</>
						}
					/>
				</div>
			</section>

			{/* ── AHL ── */}
			<section>
				<SectionHeader
					title="AHL Schedule"
					description={`Affordable Housing Levy contributions for ${periodLabel}`}
				/>
				<div className="space-y-3">
					<ReconciliationBanner
						computed={ahl.totals.ahlEmployee}
						stored={storedTotals.ahlEmployee}
						label="AHL Employee"
					/>
					<ReconciliationBanner
						computed={ahl.totals.ahlEmployer}
						stored={storedTotals.ahlEmployer}
						label="AHL Employer"
					/>
					<DataTable
						columns={ahlColumns}
						data={ahl.rows}
						exportToExcel
						exportFileName={`ahl-schedule-${periodLabel}.csv`}
						withPaginationButtons={false}
						denseCell
						customFooter={
							<>
								<TableCell colSpan={3} className="font-semibold">
									Totals
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(ahl.totals.ahlEmployee)}
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(ahl.totals.ahlEmployer)}
								</TableCell>
								<TableCell className="text-right font-semibold tabular-nums">
									{fmtCur(ahl.totals.total)}
								</TableCell>
							</>
						}
					/>
				</div>
			</section>

			{/* ── NITA ── */}
			<section>
				<SectionHeader
					title="NITA Schedule"
					description={`National Industrial Training Authority levy for ${periodLabel} — employer-only, KES 50 per employee`}
				/>
				<div className="space-y-3">
					<ReconciliationBanner
						computed={nita.totalLevy}
						stored={storedTotals.nita}
						label="NITA"
					/>
					<DataTable
						columns={nitaColumns}
						data={nitaRows}
						exportToExcel
						exportFileName={`nita-schedule-${periodLabel}.csv`}
						withPaginationButtons={false}
						denseCell
					/>
				</div>
			</section>
		</div>
	);
}
