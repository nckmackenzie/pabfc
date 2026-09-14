import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { Search } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell } from "@/components/ui/table";
import { GeneralLedgerPdf } from "@/features/reports/components/downloadable-general-ledger";
import type { GeneralLedgerReport } from "@/features/reports/services/general-ledger.api";
import { generalLedgerQueries } from "@/features/reports/services/queries";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type GeneralLedgerTableRow = GeneralLedgerReport["rows"][number];

type GeneralLedgerProps = {
	accountId: string;
	dateFrom: string;
	dateTo: string;
};

function formatBalance(value: number) {
	if (value < 0) {
		return `(${currencyFormatter(Math.abs(value), false)})`;
	}

	return currencyFormatter(value, false);
}

function formatOptionalAmount(value: number) {
	return value ? currencyFormatter(value, false) : "";
}

function formatAccountLabel(account: GeneralLedgerReport["account"]) {
	const name = toTitleCase(account.name);
	return account.code ? `${account.code} - ${name}` : name;
}

function rowDescription(row: GeneralLedgerTableRow) {
	if (row.kind === "year-reset") {
		return `Balance reset - financial year starting ${dateFormat(row.date, "reporting")}`;
	}

	return toTitleCase(row.memo || row.description || "");
}

function rowKey(row: GeneralLedgerTableRow) {
	return row.id ?? `year-reset-${row.date}`;
}

function openingBalanceLabel(report: GeneralLedgerReport) {
	return report.financialYearStart
		? `Opening balance (since ${dateFormat(report.financialYearStart, "reporting")})`
		: "Opening balance";
}

const columns: Array<ColumnDef<GeneralLedgerTableRow>> = [
	{
		accessorKey: "date",
		header: "Date",
		cell: ({ row }) => dateFormat(row.original.date, "reporting"),
	},
	{
		id: "description",
		header: "Description",
		cell: ({ row }) => rowDescription(row.original),
	},
	{
		accessorKey: "source",
		header: "Source",
		cell: ({ row }) => (row.original.source ? toTitleCase(row.original.source) : undefined),
	},
	{
		accessorKey: "reference",
		header: "Reference",
		cell: ({ row }) => (row.original.reference ? row.original.reference.toUpperCase() : undefined),
	},
	{
		accessorKey: "debit",
		header: () => <div className="text-right">Debit</div>,
		cell: ({ row }) => (
			<div className="text-right tabular-nums">{formatOptionalAmount(row.original.debit)}</div>
		),
	},
	{
		accessorKey: "credit",
		header: () => <div className="text-right">Credit</div>,
		cell: ({ row }) => (
			<div className="text-right tabular-nums">{formatOptionalAmount(row.original.credit)}</div>
		),
	},
	{
		accessorKey: "runningBalance",
		header: () => <div className="text-right">Balance</div>,
		cell: ({ row }) => (
			<div className="text-right tabular-nums">{formatBalance(row.original.runningBalance)}</div>
		),
	},
];

export function GeneralLedger({ accountId, dateFrom, dateTo }: GeneralLedgerProps) {
	const [search, setSearch] = useState("");
	// Keeps the current report on screen while a new search term loads instead of
	// re-suspending the whole report.
	const deferredSearch = useDeferredValue(search);

	const dateRange = { from: dateFrom, to: dateTo };
	const { data: report } = useSuspenseQuery(
		generalLedgerQueries.report({ accountId, dateRange, q: deferredSearch || undefined })
	);
	// The PDF always exports the full period so its rows match its totals and
	// closing balance, whatever the on-screen search.
	const { data: fullReport } = useSuspenseQuery(
		generalLedgerQueries.report({ accountId, dateRange })
	);

	const accountLabel = formatAccountLabel(report.account);
	const period = `${dateFormat(dateFrom, "long")} to ${dateFormat(dateTo, "long")}`;
	const isFiltered = Boolean(deferredSearch);
	const hasTransactions = report.rows.some((row) => row.kind === "transaction");

	return (
		<div className="space-y-6">
			<div className="flex justify-end no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={
							<GeneralLedgerPdf
								data={{
									accountLabel,
									period,
									openingBalanceLabel: openingBalanceLabel(fullReport),
									openingBalance: formatBalance(fullReport.openingBalance),
									rows: fullReport.rows.map((row) => ({
										key: rowKey(row),
										date: dateFormat(row.date, "reporting"),
										description: rowDescription(row),
										source: row.source ? toTitleCase(row.source) : "",
										reference: row.reference ? row.reference.toUpperCase() : "",
										debit: formatOptionalAmount(row.debit),
										credit: formatOptionalAmount(row.credit),
										runningBalance: formatBalance(row.runningBalance),
									})),
									totalDebits: currencyFormatter(fullReport.totalDebits, false),
									totalCredits: currencyFormatter(fullReport.totalCredits, false),
									closingBalance: formatBalance(fullReport.closingBalance),
								}}
							/>
						}
						fileName={`General-Ledger-${fullReport.account.code ?? fullReport.account.id}.pdf`}
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

			<div className="text-center">
				<h2 className="text-xl font-bold tracking-wide uppercase">General Ledger</h2>
				<p className="text-base font-medium mt-1">{accountLabel}</p>
				<p className="text-sm text-muted-foreground">{period}</p>
			</div>

			<dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
				<SummaryItem
					label={openingBalanceLabel(report)}
					value={formatBalance(report.openingBalance)}
				/>
				<SummaryItem label="Total debits" value={currencyFormatter(report.totalDebits, false)} />
				<SummaryItem label="Total credits" value={currencyFormatter(report.totalCredits, false)} />
				<SummaryItem label="Closing balance" value={formatBalance(report.closingBalance)} />
			</dl>

			<Search
				placeholder="Search memo, reference, source or description..."
				onHandleSearch={(q: string) => setSearch(q)}
			/>

			{!hasTransactions ? (
				<EmptyState
					icon={isFiltered ? <SearchIcon /> : undefined}
					title="No Transactions"
					description={
						isFiltered
							? `No transactions matching "${deferredSearch}" for this period`
							: "No transactions posted to this account for the selected period"
					}
				/>
			) : (
				<div className={search !== deferredSearch ? "opacity-60 transition-opacity" : undefined}>
					<DataTable
						data={report.rows}
						columns={columns}
						customFooter={
							<>
								<TableCell colSpan={4}>
									Totals
									{isFiltered ? (
										<span className="ml-2 text-xs font-normal text-muted-foreground">
											(full period, unfiltered)
										</span>
									) : undefined}
								</TableCell>
								<TableCell className="text-right px-4 tabular-nums">
									{currencyFormatter(report.totalDebits, false)}
								</TableCell>
								<TableCell className="text-right px-4 tabular-nums">
									{currencyFormatter(report.totalCredits, false)}
								</TableCell>
								<TableCell className="text-right px-4 tabular-nums">
									{formatBalance(report.closingBalance)}
								</TableCell>
							</>
						}
					/>
				</div>
			)}
		</div>
	);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border bg-card p-4">
			<dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
			<dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
		</div>
	);
}

export function GeneralLedgerSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex justify-end no-print">
				<Skeleton className="h-9 w-32" />
			</div>
			<div className="flex flex-col items-center gap-1">
				<h2 className="text-xl font-bold tracking-wide uppercase">General Ledger</h2>
				<Skeleton className="h-5 w-56" />
				<Skeleton className="h-4 w-72" />
			</div>
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton array
					<Skeleton key={i} className="h-20" />
				))}
			</div>
			<DatatableSkeleton />
		</div>
	);
}
