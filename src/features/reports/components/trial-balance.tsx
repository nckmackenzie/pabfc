import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrialBalancePdf } from "@/features/reports/components/downloadable-trial-balance";
import { TrialBalanceDrillDown } from "@/features/reports/components/trial-balance-drilldown";
import {
	getTrialBalance,
	type TrialBalanceParentRow,
} from "@/features/reports/services/trial-balance.api";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const route = getRouteApi("/app/reports/finance/trial-balance/");

export function TrialBalance() {
	const { filters } = useFilters(route.id);

	const { data } = useSuspenseQuery({
		queryKey: ["reports", "trial-balance", filters],
		queryFn: () =>
			getTrialBalance({
				data: { asOfDate: filters.asOfDate ?? "" },
			}),
	});

	const rows = data;

	const totalDebits = rows.reduce(
		(sum, row) => sum + Number(row.debit_balance),
		0,
	);
	const totalCredits = rows.reduce(
		(sum, row) => sum + Number(row.credit_balance),
		0,
	);

	const formattedAsOfDate = filters.asOfDate
		? dateFormat(filters.asOfDate, "long")
		: "";

	return (
		<div>
			<div className="flex justify-end mb-4 no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={
							<TrialBalancePdf
								data={{
									asOfDate: formattedAsOfDate,
									rows: rows.map((r) => ({
										label: r.code ? `${r.code} - ${r.name}` : r.name,
										debit: Number(r.debit_balance)
											? currencyFormatter(Number(r.debit_balance), false)
											: "",
										credit: Number(r.credit_balance)
											? currencyFormatter(Number(r.credit_balance), false)
											: "",
									})),
									totalDebits: currencyFormatter(totalDebits, false),
									totalCredits: currencyFormatter(totalCredits, false),
								}}
							/>
						}
						fileName="Trial-Balance.pdf"
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

			<div className="trial-balance-report">
				<div className="text-center mb-8">
					<h2 className="text-xl font-bold tracking-wide uppercase">
						Trial Balance
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						As of {formattedAsOfDate}
					</p>
				</div>

				<div className="max-w-4xl mx-auto text-sm">
					<div className="grid grid-cols-12 gap-4 border-b border-foreground pb-2 mb-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">
						<div className="col-span-8">Account</div>
						<div className="col-span-2 text-right">Debit</div>
						<div className="col-span-2 text-right">Credit</div>
					</div>

					<div className="space-y-1">
						{rows.map((row) => (
							<TrialBalanceItem
								key={row.id}
								row={row}
								asOfDate={filters.asOfDate ?? ""}
							/>
						))}
					</div>

					<div className="grid grid-cols-12 gap-4 py-4 mt-6 border-t-2 border-b-4 border-double border-foreground font-bold text-base">
						<div className="col-span-8 text-right pr-4">TOTALS</div>
						<div className="col-span-2 text-right tabular-nums">
							{currencyFormatter(totalDebits, false)}
						</div>
						<div className="col-span-2 text-right tabular-nums">
							{currencyFormatter(totalCredits, false)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function TrialBalanceItem({
	row,
	asOfDate,
}: {
	row: TrialBalanceParentRow;
	asOfDate: string;
}) {
	const { setOpen } = useSheet();
	const hasDebit = Number(row.debit_balance) > 0;
	const hasCredit = Number(row.credit_balance) > 0;
	const label = row.code ? `${row.code} - ${row.name}` : row.name;

	function handleOpenDrillDown() {
		setOpen(<TrialBalanceDrillDown id={row.id} asOfDate={asOfDate} />, {
			className: "max-w-6xl!",
			title: "Trial Balance",
			description: `Detailed transactions for account: ${toTitleCase(label)}`,
		});
	}

	return (
		<div className="grid grid-cols-12 gap-4 py-1.5 items-center hover:bg-muted/50 transition-colors">
			<div className="col-span-8">{label}</div>
			<div className="col-span-2 text-right tabular-nums">
				{hasDebit ? (
					<button
						type="button"
						className="font-medium cursor-pointer text-blue-500 hover:text-blue-600 hover:underline transition-all"
						onClick={handleOpenDrillDown}
					>
						{currencyFormatter(Number(row.debit_balance), false)}
					</button>
				) : undefined}
			</div>
			<div className="col-span-2 text-right tabular-nums">
				{hasCredit ? (
					<button
						type="button"
						className="font-medium cursor-pointer text-blue-500 hover:text-blue-600 hover:underline transition-all"
						onClick={handleOpenDrillDown}
					>
						{currencyFormatter(Number(row.credit_balance), false)}
					</button>
				) : undefined}
			</div>
		</div>
	);
}

export function TrialBalanceSkeleton() {
	return (
		<div>
			<div className="flex justify-end mb-4 no-print">
				<Skeleton className="h-9 w-32" />
			</div>

			<div className="trial-balance-report">
				<div className="flex flex-col items-center text-center mb-8">
					<h2 className="text-xl font-bold tracking-wide uppercase">
						Trial Balance
					</h2>
					<Skeleton className="h-5 w-32 mt-1" />
				</div>

				<div className="max-w-4xl mx-auto text-sm">
					<div className="grid grid-cols-12 gap-4 border-b border-foreground pb-2 mb-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">
						<div className="col-span-8">Account</div>
						<div className="col-span-2 text-right">Debit</div>
						<div className="col-span-2 text-right">Credit</div>
					</div>

					<div className="space-y-1">
						{Array.from({ length: 8 }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array
								key={i}
								className="grid grid-cols-12 gap-4 py-1.5 items-center hover:bg-muted/50 transition-colors"
							>
								<div className="col-span-8">
									<Skeleton className="h-4 w-64" />
								</div>
								<div className="col-span-2 flex justify-end">
									<Skeleton className="h-4 w-24" />
								</div>
								<div className="col-span-2 flex justify-end">
									<Skeleton className="h-4 w-24" />
								</div>
							</div>
						))}
					</div>

					<div className="grid grid-cols-12 gap-4 py-4 mt-6 border-t-2 border-b-4 border-double border-foreground font-bold text-base">
						<div className="col-span-8 text-right pr-4">TOTALS</div>
						<div className="col-span-2 flex justify-end">
							<Skeleton className="h-5 w-28" />
						</div>
						<div className="col-span-2 flex justify-end">
							<Skeleton className="h-5 w-28" />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
