import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getDeductionsReportForPeriod } from "@/features/reports/services/payroll-deductions.api";
import { useExportToCsv } from "@/hooks/use-export-to-csv";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import type {
	StatutoryDeductionRow,
	VoluntaryDeductionRow,
} from "@/features/reports/lib/payroll-deductions";

const route = getRouteApi("/app/reports/payroll/deductions/");
const fmtCur = (v: number) => currencyFormatter(v, false);

const statutoryColumns: Array<ColumnDef<StatutoryDeductionRow>> = [
	{ accessorKey: "employeeName", header: "Employee Name" },
	{ accessorKey: "employeeNo", header: "Employee No" },
	{ accessorKey: "category", header: "Category" },
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.amount)}</div>,
	},
];

const voluntaryColumns: Array<ColumnDef<VoluntaryDeductionRow>> = [
	{ accessorKey: "employeeName", header: "Employee Name" },
	{ accessorKey: "employeeNo", header: "Employee No" },
	{ accessorKey: "description", header: "Description" },
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => <div className="text-right tabular-nums">{fmtCur(row.original.amount)}</div>,
	},
];

function SectionHeading({ title }: { title: string }) {
	return (
		<h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1 mb-3">
			{title}
		</h3>
	);
}

export function PayrollDeductionsReport() {
	const { filters } = useFilters(route.id);
	const { exportToCsv } = useExportToCsv();

	const { data } = useSuspenseQuery({
		queryKey: ["reports", "payroll-deductions", filters.payrollPeriodId],
		queryFn: () =>
			getDeductionsReportForPeriod({
				data: { payrollPeriodId: filters.payrollPeriodId ?? "" },
			}),
		staleTime: 0,
	});

	const { statutory, voluntary, grandTotal } = data;
	const periodLabel = data.period.name;

	function handleExport() {
		// Flat export: "Deduction Type" column carries group/category information.
		// Note: export is flat CSV — grouped subtotals are not included in the export.
		const flatRows: Array<Record<string, unknown>> = [];

		for (const row of statutory.rows) {
			flatRows.push({
				Group: "Statutory",
				"Deduction Type": row.category,
				"Employee Name": row.employeeName,
				"Employee No": row.employeeNo,
				Description: "",
				Amount: row.amount,
			});
		}

		for (const group of voluntary.groups) {
			for (const row of group.rows) {
				flatRows.push({
					Group: "Voluntary",
					"Deduction Type": group.label,
					"Employee Name": row.employeeName,
					"Employee No": row.employeeNo,
					Description: row.description,
					Amount: row.amount,
				});
			}
		}

		exportToCsv(flatRows, `payroll-deductions-${periodLabel}.csv`);
	}

	return (
		<div className="space-y-8">
			{/* Single export button for the whole report */}
			{(statutory.rows.length > 0 || voluntary.groups.length > 0) && (
				<div className="flex justify-end">
					<Button variant="outline" size="sm" onClick={handleExport}>
						Export to Excel
					</Button>
				</div>
			)}

			{/* Statutory deductions */}
			<section>
				<SectionHeading title="Statutory Deductions" />
				<DataTable
					columns={statutoryColumns}
					data={statutory.rows}
					withPaginationButtons={false}
					denseCell
					customFooter={
						<>
							<TableCell colSpan={3} className="font-semibold">
								Statutory Subtotal
							</TableCell>
							<TableCell className="text-right font-semibold tabular-nums">
								{fmtCur(statutory.totals.subtotal)}
							</TableCell>
						</>
					}
				/>
				<div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
					{[
						{ label: "PAYE", value: statutory.totals.paye },
						{ label: "NSSF Employee", value: statutory.totals.nssfEmployee },
						{ label: "SHIF", value: statutory.totals.shifEmployee },
						{ label: "AHL Employee", value: statutory.totals.ahlEmployee },
						{ label: "HELB", value: statutory.totals.helb },
					].map((item) => (
						<div key={item.label} className="rounded-md border bg-muted/40 px-3 py-2">
							<p className="text-xs text-muted-foreground">{item.label}</p>
							<p className="font-semibold tabular-nums">{fmtCur(item.value)}</p>
						</div>
					))}
				</div>
			</section>

			{/* Voluntary deductions — one sub-section per type */}
			{voluntary.groups.length > 0 && (
				<section>
					<SectionHeading title="Voluntary Deductions" />
					<div className="space-y-6">
						{voluntary.groups.map((group) => (
							<div key={group.deductionType}>
								<p className="text-sm font-medium mb-2">{group.label}</p>
								<DataTable
									columns={voluntaryColumns}
									data={group.rows}
									withPaginationButtons={false}
									denseCell
									customFooter={
										<>
											<TableCell colSpan={3} className="font-semibold">
												{group.label} Subtotal
											</TableCell>
											<TableCell className="text-right font-semibold tabular-nums">
												{fmtCur(group.subtotal)}
											</TableCell>
										</>
									}
								/>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Grand total */}
			<div className="rounded-md border bg-muted/50 px-4 py-3 flex items-center justify-between">
				<p className="font-semibold">Grand Total — All Deductions ({periodLabel})</p>
				<p className="text-lg font-bold tabular-nums">{fmtCur(grandTotal)}</p>
			</div>
		</div>
	);
}
