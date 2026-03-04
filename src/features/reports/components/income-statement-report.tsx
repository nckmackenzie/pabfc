import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncomeStatementPdf } from "@/features/reports/components/downloadable-income-statement";
import {
	getIncomeStatement,
	type IncomeStatementParentRow,
} from "@/features/reports/services/income-statement.api";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";
import { IncomeStatementDrillDown } from "./income-statement-drilldown";

const route = getRouteApi("/app/reports/finance/income-statement/");

export function IncomeStatementReport() {
	const { filters } = useFilters(route.id);

	const { data } = useSuspenseQuery({
		queryKey: ["reports", "income-statement", filters],
		queryFn: () =>
			getIncomeStatement({
				data: {
					dateRange: {
						from: filters.dateRange?.from ?? "",
						to: filters.dateRange?.to ?? "",
					},
				},
			}),
	});

	const rows = data.flatMap((d) => d.rows ?? d) as IncomeStatementParentRow[];

	const revenueRows = rows.filter((row) => row.type === "revenue");
	const expenseRows = rows.filter((row) => row.type === "expense");

	const totalRevenue = revenueRows.reduce((sum, r) => sum + Number(r.total), 0);
	const totalExpenses = expenseRows.reduce(
		(sum, r) => sum + Number(r.total),
		0,
	);
	const netIncome = totalRevenue - totalExpenses;

	const fromDate = filters.dateRange?.from
		? dateFormat(filters.dateRange.from, "long")
		: "";
	const toDate = filters.dateRange?.to
		? dateFormat(filters.dateRange.to, "long")
		: "";

	return (
		<div>
			<div className="flex justify-end mb-4 no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={
							<IncomeStatementPdf
								data={{
									fromDate,
									toDate,
									revenueRows: revenueRows.map((r) => ({
										label: r.name.toUpperCase(),
										amount: formatStatementAmount(Number(r.total)),
									})),
									expenseRows: expenseRows.map((r) => ({
										label: r.name.toUpperCase(),
										amount: formatStatementAmount(Number(r.total)),
									})),
									totalRevenue: formatStatementAmount(totalRevenue),
									totalExpenses: formatStatementAmount(totalExpenses),
									netIncome: formatStatementAmount(netIncome),
									isNegativeNetIncome: netIncome < 0,
								}}
							/>
						}
						fileName="Income-Statement.pdf"
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

			<div className="income-statement-report">
				<div className="text-center mb-8">
					<h2 className="text-xl font-bold tracking-wide uppercase">
						Income Statement
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						For the period {fromDate} to {toDate}
					</p>
				</div>

				<div className="max-w-2xl mx-auto space-y-6 text-sm">
					<section>
						<h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
							Revenue
						</h3>
						{revenueRows.map((row: IncomeStatementParentRow) => (
							<StatementRow
								key={row.id}
								label={row.name.toUpperCase()}
								amount={Number(row.total)}
								id={row.id}
								dateFrom={filters.dateRange?.from ?? new Date().toISOString()}
								dateTo={filters.dateRange?.to ?? new Date().toISOString()}
							/>
						))}
						<TotalRow label="TOTAL REVENUE" amount={totalRevenue} />
					</section>

					<section>
						<h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
							Expenses
						</h3>
						{expenseRows.map((row: IncomeStatementParentRow) => (
							<StatementRow
								key={row.id}
								label={row.name.toUpperCase()}
								amount={Number(row.total)}
								id={row.id}
								dateFrom={filters.dateRange?.from ?? new Date().toISOString()}
								dateTo={filters.dateRange?.to ?? new Date().toISOString()}
							/>
						))}
						<TotalRow label="TOTAL EXPENSES" amount={totalExpenses} />
					</section>

					<section className="pt-2">
						<div className="flex justify-between items-center py-2 border-t-2 border-b-4 border-double border-foreground font-bold text-base">
							<span>NET INCOME</span>
							<span className={netIncome < 0 ? "text-destructive" : ""}>
								{formatStatementAmount(netIncome)}
							</span>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

function StatementRow({
	label,
	amount,
	id,
	dateFrom,
	dateTo,
}: {
	label: string;
	amount: number;
	id: number;
	dateFrom: string;
	dateTo: string;
}) {
	const { setOpen } = useSheet();

	function handleOpenDrillDown() {
		setOpen(
			<IncomeStatementDrillDown
				id={id}
				key={id}
				dateFrom={dateFrom}
				dateTo={dateTo}
			/>,
			{
				className: "max-w-6xl!",
				title: "Income Statement",
				description: `Detailed breakdown of account: ${toTitleCase(label)}`,
			},
		);
	}
	return (
		<div className="flex justify-between items-center py-1">
			<span>{label}</span>
			<button
				type="button"
				className="cursor-pointer text-blue-600 transition-all hover:text-blue-800 hover:underline"
				onClick={handleOpenDrillDown}
			>
				{formatStatementAmount(amount)}
			</button>
		</div>
	);
}

function TotalRow({ label, amount }: { label: string; amount: number }) {
	return (
		<div className="flex justify-between items-center py-1.5 mt-1 border-t border-foreground/30 font-semibold">
			<span className="pl-6">{label}</span>
			<span className="border-b border-foreground/50">
				{formatStatementAmount(amount)}
			</span>
		</div>
	);
}

function formatStatementAmount(value: number): string {
	if (value < 0) {
		return `(${currencyFormatter(Math.abs(value), false)})`;
	}
	return currencyFormatter(value, false);
}
