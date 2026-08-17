import { PDFDownloadLink } from "@react-pdf/renderer";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TrialBalancePdf } from "@/features/reports/components/downloadable-trial-balance";
import { TrialBalanceDrillDown } from "@/features/reports/components/trial-balance-drilldown";
// import { isTrialBalanced } from "@/features/reports/lib/report-balance-checks";
import {
	getTrialBalance,
	getTrialBalanceChildren,
	type TrialBalanceRow,
} from "@/features/reports/services/trial-balance.api";
import { useFilters } from "@/hooks/use-filters";
import { useSheet } from "@/integrations/sheet-provider";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const route = getRouteApi("/app/reports/finance/trial-balance/");

const INDENT_PER_LEVEL_PX = 20;
const CHEVRON_OFFSET_PX = 20;

function indentStyle(depth: number, extraPx = 0) {
	return { paddingLeft: depth * INDENT_PER_LEVEL_PX + extraPx };
}

function trialBalanceChildrenQueryOptions(id: number, asOfDate: string) {
	return queryOptions({
		queryKey: ["trial-balance-children", { id, asOfDate }],
		queryFn: () => getTrialBalanceChildren({ data: { id, asOfDate } }),
		staleTime: 0,
	});
}

export function TrialBalance() {
	const { filters } = useFilters(route.id);

	const { data } = useSuspenseQuery({
		queryKey: ["reports", "trial-balance", filters],
		queryFn: () =>
			getTrialBalance({
				data: { asOfDate: filters.asOfDate ?? "" },
			}),
		staleTime: 0,
	});

	const rows = data;

	const totalDebits = rows.reduce((sum, row) => sum + Number(row.debit_balance), 0);
	const totalCredits = rows.reduce((sum, row) => sum + Number(row.credit_balance), 0);
	// const balanced = isTrialBalanced(rows);

	const formattedAsOfDate = filters.asOfDate ? dateFormat(filters.asOfDate, "long") : "";

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
					<h2 className="text-xl font-bold tracking-wide uppercase">Trial Balance</h2>
					<p className="text-sm text-muted-foreground mt-1">As of {formattedAsOfDate}</p>
				</div>

				<div className="max-w-4xl mx-auto text-sm">
					<div className="grid grid-cols-12 gap-4 border-b border-foreground pb-2 mb-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">
						<div className="col-span-8">Account</div>
						<div className="col-span-2 text-right">Debit</div>
						<div className="col-span-2 text-right">Credit</div>
					</div>

					<div className="space-y-1">
						{rows.map((row) => (
							<TrialBalanceItem key={row.id} row={row} asOfDate={filters.asOfDate ?? ""} />
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

					{/* <div
						className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
							balanced
								? "border-green-200 bg-green-50 text-green-700"
								: "border-red-200 bg-red-50 text-red-700"
						}`}
					>
						{balanced
							? "In balance — total debits equal total credits."
							: `Out of balance by ${currencyFormatter(Math.abs(totalDebits - totalCredits), false)} — total debits do not equal total credits.`}
					</div> */}
				</div>
			</div>
		</div>
	);
}

function TrialBalanceItem({
	row,
	asOfDate,
	depth = 0,
}: {
	row: TrialBalanceRow;
	asOfDate: string;
	depth?: number;
}) {
	const { setOpen } = useSheet();
	const [isExpanded, setIsExpanded] = useState(false);
	const hasDebit = Number(row.debit_balance) > 0;
	const hasCredit = Number(row.credit_balance) > 0;
	const label = row.code ? `${row.code} - ${row.name}` : row.name;

	function toggleExpanded() {
		setIsExpanded((expanded) => !expanded);
	}

	function handleOpenDrillDown() {
		setOpen(<TrialBalanceDrillDown id={row.id} asOfDate={asOfDate} />, {
			className: "max-w-6xl!",
			title: "Trial Balance",
			description: `Detailed transactions for account: ${toTitleCase(label)}`,
		});
	}

	// Rows that have children drill down inline, one level at a time. Only a true
	// posting leaf falls through to the transaction listing sheet.
	function handleAmountClick() {
		if (row.hasChildren) {
			toggleExpanded();
			return;
		}

		handleOpenDrillDown();
	}

	return (
		<>
			<div className="grid grid-cols-12 gap-4 py-1.5 items-center hover:bg-muted/50 transition-colors">
				<div className="col-span-8" style={indentStyle(depth)}>
					{row.hasChildren ? (
						<button
							type="button"
							className="flex items-center gap-1 text-left cursor-pointer hover:underline"
							aria-expanded={isExpanded}
							onClick={toggleExpanded}
						>
							{isExpanded ? (
								<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
							) : (
								<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
							)}
							{label}
						</button>
					) : (
						<span style={indentStyle(0, CHEVRON_OFFSET_PX)}>{label}</span>
					)}
				</div>
				<div className="col-span-2 text-right tabular-nums">
					{hasDebit ? (
						<TrialBalanceAmount value={row.debit_balance} onClick={handleAmountClick} />
					) : undefined}
				</div>
				<div className="col-span-2 text-right tabular-nums">
					{hasCredit ? (
						<TrialBalanceAmount value={row.credit_balance} onClick={handleAmountClick} />
					) : undefined}
				</div>
			</div>
			{row.hasChildren && isExpanded ? (
				<TrialBalanceChildRows parentId={row.id} asOfDate={asOfDate} depth={depth + 1} />
			) : undefined}
		</>
	);
}

function TrialBalanceAmount({ value, onClick }: { value: string; onClick: () => void }) {
	return (
		<button
			type="button"
			className="font-medium cursor-pointer text-blue-500 hover:text-blue-600 hover:underline transition-all"
			onClick={onClick}
		>
			{currencyFormatter(Number(value), false)}
		</button>
	);
}

function TrialBalanceChildRows({
	parentId,
	asOfDate,
	depth,
}: {
	parentId: number;
	asOfDate: string;
	depth: number;
}) {
	const { data, isPending, isError, error, refetch } = useQuery(
		trialBalanceChildrenQueryOptions(parentId, asOfDate)
	);

	if (isPending) {
		return (
			<div
				className="flex items-center gap-2 py-1.5 text-muted-foreground"
				style={indentStyle(depth, CHEVRON_OFFSET_PX)}
			>
				<Spinner />
				<span>Loading accounts...</span>
			</div>
		);
	}

	if (isError) {
		return (
			<div
				className="flex items-center gap-2 py-1.5 text-destructive"
				style={indentStyle(depth, CHEVRON_OFFSET_PX)}
			>
				<TriangleAlertIcon className="size-4 shrink-0" />
				<span>{error.message || "Unable to load child accounts."}</span>
				<button
					type="button"
					className="underline cursor-pointer font-medium"
					onClick={() => refetch()}
				>
					Retry
				</button>
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div
				className="py-1.5 text-muted-foreground italic"
				style={indentStyle(depth, CHEVRON_OFFSET_PX)}
			>
				No child accounts with a balance.
			</div>
		);
	}

	return (
		<>
			{data.map((child) => (
				<TrialBalanceItem key={child.id} row={child} asOfDate={asOfDate} depth={depth} />
			))}
		</>
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
					<h2 className="text-xl font-bold tracking-wide uppercase">Trial Balance</h2>
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
