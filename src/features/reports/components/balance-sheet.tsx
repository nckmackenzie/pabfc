import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceSheetDrillDown } from "@/features/reports/components/balance-sheet-drilldown";
import { BalanceSheetPdf } from "@/features/reports/components/downloadable-balance-sheet";
import {
	type BalanceSheetRow,
	getBalanceSheetReport,
} from "@/features/reports/services/balance-sheet.api";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const route = getRouteApi("/app/reports/finance/balance-sheet/");

export function BalanceSheet() {
	const { filters } = useFilters(route.id);

	const { data } = useSuspenseQuery({
		queryKey: ["reports", "balance-sheet", filters],
		queryFn: () =>
			getBalanceSheetReport({
				data: { asOfDate: filters.asOfDate ?? "" },
			}),
	});

	const rows = data;

	const assetRows = rows.filter((row) => row.type === "asset");
	const liabilityRows = rows.filter((row) => row.type === "liability");
	const equityRows = rows.filter((row) => row.type === "equity");

	const totalAssets = assetRows.reduce(
		(sum, row) => sum + Number(row.total),
		0,
	);
	const totalLiabilities = liabilityRows.reduce(
		(sum, row) => sum + Number(row.total),
		0,
	);
	const totalEquity = equityRows.reduce(
		(sum, row) => sum + Number(row.total),
		0,
	);
	const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

	const formattedAsOfDate = filters.asOfDate
		? dateFormat(filters.asOfDate, "long")
		: "";

	return (
		<div>
			<div className="flex justify-end mb-4 no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={
							<BalanceSheetPdf
								data={{
									asOfDate: formattedAsOfDate,
									assetRows: assetRows.map((r) => ({
										label: reportLabel(r),
										amount: formatStatementAmount(Number(r.total)),
									})),
									liabilityRows: liabilityRows.map((r) => ({
										label: reportLabel(r),
										amount: formatStatementAmount(Number(r.total)),
									})),
									equityRows: equityRows.map((r) => ({
										label: reportLabel(r),
										amount: formatStatementAmount(Number(r.total)),
									})),
									totalAssets: formatStatementAmount(totalAssets),
									totalLiabilities: formatStatementAmount(totalLiabilities),
									totalEquity: formatStatementAmount(totalEquity),
									totalLiabilitiesAndEquity: formatStatementAmount(
										totalLiabilitiesAndEquity,
									),
								}}
							/>
						}
						fileName="Balance-Sheet.pdf"
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

			<div className="balance-sheet-report">
				<div className="text-center mb-8">
					<h2 className="text-xl font-bold tracking-wide uppercase">
						Balance Sheet
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						As of {formattedAsOfDate}
					</p>
				</div>

				<div className="max-w-2xl mx-auto space-y-6 text-sm">
					<Section
						title="Assets"
						rows={assetRows}
						totalLabel="TOTAL ASSETS"
						total={totalAssets}
						asOfDate={filters.asOfDate ?? ""}
					/>

					<Section
						title="Liabilities"
						rows={liabilityRows}
						totalLabel="TOTAL LIABILITIES"
						total={totalLiabilities}
						asOfDate={filters.asOfDate ?? ""}
					/>

					<Section
						title="Equity"
						rows={equityRows}
						totalLabel="TOTAL EQUITY"
						total={totalEquity}
						asOfDate={filters.asOfDate ?? ""}
					/>

					<div className="pt-2">
						<div className="flex justify-between items-center py-2 border-t-2 border-b-4 border-double border-foreground font-bold text-base">
							<span>TOTAL LIABILITIES &amp; EQUITY</span>
							<span>{formatStatementAmount(totalLiabilitiesAndEquity)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function Section({
	title,
	rows,
	totalLabel,
	total,
	asOfDate,
}: {
	title: string;
	rows: Array<BalanceSheetRow>;
	totalLabel: string;
	total: number;
	asOfDate: string;
}) {
	return (
		<section>
			<h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-3">
				{title}
			</h3>
			{rows.map((row) => (
				<BalanceSheetRowItem
					key={`${row.type}-${row.name}`}
					row={row}
					asOfDate={asOfDate}
				/>
			))}
			<TotalRow label={totalLabel} amount={total} />
		</section>
	);
}

function BalanceSheetRowItem({
	row,
	asOfDate,
}: {
	row: BalanceSheetRow;
	asOfDate: string;
}) {
	const { setOpen } = useSheet();
	const canDrillDown = Boolean(row.id) && row.is_computed === 0;
	const label = reportLabel(row);

	function handleOpenDrillDown() {
		if (!row.id) {
			return;
		}

		setOpen(<BalanceSheetDrillDown id={row.id} asOfDate={asOfDate} />, {
			className: "max-w-6xl!",
			title: "Balance Sheet",
			description: `Detailed transactions for account: ${toTitleCase(label)}`,
		});
	}

	return (
		<div className="flex justify-between items-center py-1">
			<span className={row.is_computed ? "italic" : undefined}>{label}</span>
			{canDrillDown ? (
				<button
					type="button"
					className="cursor-pointer text-blue-500 transition-all hover:text-blue-600 hover:underline"
					onClick={handleOpenDrillDown}
				>
					{formatStatementAmount(Number(row.total))}
				</button>
			) : (
				<span>{formatStatementAmount(Number(row.total))}</span>
			)}
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

function reportLabel(row: BalanceSheetRow): string {
	if (row.code) {
		return `${row.code} - ${row.name}`;
	}

	return row.name;
}

function formatStatementAmount(value: number): string {
	if (value < 0) {
		return `(${currencyFormatter(Math.abs(value), false)})`;
	}

	return currencyFormatter(value, false);
}

export function BalanceSheetSkeleton() {
	return (
		<div>
			<div className="flex justify-end mb-4 no-print">
				<Skeleton className="h-9 w-32" />
			</div>

			<div className="balance-sheet-report">
				<div className="flex flex-col items-center text-center mb-8">
					<h2 className="text-xl font-bold tracking-wide uppercase">
						Balance Sheet
					</h2>
					<Skeleton className="h-5 w-32 mt-1" />
				</div>

				<div className="max-w-2xl mx-auto space-y-6">
					{["Assets", "Liabilities", "Equity"].map((section) => (
						<div key={section} className="space-y-2">
							<p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
								{section}
							</p>
							{Array.from({ length: 4 }).map((_, index) => (
								<div
									key={`${section}-${index.toString()}`}
									className="flex justify-between items-center py-1"
								>
									<Skeleton className="h-4 w-48" />
									<Skeleton className="h-4 w-24" />
								</div>
							))}
							<div className="flex justify-between items-center py-1.5 mt-1 border-t border-foreground/30">
								<Skeleton className="h-4 w-32 ml-6" />
								<Skeleton className="h-4 w-28" />
							</div>
						</div>
					))}

					<div className="flex justify-between items-center py-2 border-t-2 border-b-4 border-double border-foreground">
						<Skeleton className="h-5 w-56" />
						<Skeleton className="h-5 w-32" />
					</div>
				</div>
			</div>
		</div>
	);
}
