import { useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { Search } from "@/components/ui/search";
import { TableCell } from "@/components/ui/table";
import { getTrialBalanceDrillDown } from "@/features/reports/services/trial-balance.api";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type DrillDownItem = Awaited<
	ReturnType<typeof getTrialBalanceDrillDown>
>[number];

const columns: Array<ColumnDef<DrillDownItem>> = [
	{
		accessorKey: "date",
		header: "Date",
		cell: ({ row }) => dateFormat(row.original.date, "reporting"),
	},
	{
		accessorKey: "accountName",
		header: "Account Name",
		cell: ({ row }) => toTitleCase(row.original.accountName),
	},
	{
		accessorKey: "description",
		header: "Description",
		cell: ({ row }) => toTitleCase(row.original.description ?? ""),
	},
	{
		accessorKey: "source",
		header: "Source",
		cell: ({
			row: {
				original: { source },
			},
		}) => (source ? toTitleCase(source) : undefined),
	},
	{
		accessorKey: "reference",
		header: "Reference",
		cell: ({
			row: {
				original: { reference },
			},
		}) => (reference ? toTitleCase(reference) : undefined),
	},
	{
		id: "debit",
		header: () => <div className="text-right">Debit</div>,
		cell: ({ row }) => {
			const amount = toNumber(row.original.amount);
			return (
				<div className="text-right">
					{row.original.dc === "debit"
						? currencyFormatter(amount, false)
						: undefined}
				</div>
			);
		},
	},
	{
		id: "credit",
		header: () => <div className="text-right">Credit</div>,
		cell: ({ row }) => {
			const amount = toNumber(row.original.amount);
			return (
				<div className="text-right">
					{row.original.dc === "credit"
						? currencyFormatter(amount, false)
						: undefined}
				</div>
			);
		},
	},
	{
		id: "net",
		header: () => <div className="text-right">Net</div>,
		cell: ({ row }) => {
			const amount = toNumber(row.original.amount);
			const net = row.original.dc === "debit" ? amount : -amount;
			return <div className="text-right">{formatNetAmount(net)}</div>;
		},
	},
];

export function TrialBalanceDrillDown({
	id,
	asOfDate,
}: {
	id: number;
	asOfDate: string;
}) {
	const [search, setSearch] = useState<string>();

	return (
		<div className="px-4 space-y-4">
			<Search
				placeholder="Search transactions..."
				onHandleSearch={(q: string) => setSearch(q)}
			/>
			<ErrorBoundaryWithSuspense
				loader={<DatatableSkeleton />}
				errorMessage="Error fetching data for the selected account."
			>
				<DrilldownTable id={id} asOfDate={asOfDate} search={search} />
			</ErrorBoundaryWithSuspense>
		</div>
	);
}

function DrilldownTable({
	id,
	asOfDate,
	search,
}: {
	id: number;
	asOfDate: string;
	search?: string;
}) {
	const { data } = useSuspenseQuery({
		queryKey: ["trial-balance-drilldown", { id, asOfDate, search }],
		queryFn: () =>
			getTrialBalanceDrillDown({
				data: { id, asOfDate, q: search },
			}),
	});

	const totalDebit = data
		.filter((item) => item.dc === "debit")
		.reduce((acc, item) => acc + toNumber(item.amount), 0);
	const totalCredit = data
		.filter((item) => item.dc === "credit")
		.reduce((acc, item) => acc + toNumber(item.amount), 0);
	const net = totalDebit - totalCredit;

	if (data.length === 0) {
		return (
			<EmptyState
				icon={search ? <SearchIcon /> : undefined}
				title="No Transactions"
				description={`No transactions found ${search ? `matching ${search}` : "for selected account"}`}
			/>
		);
	}

	return (
		<DataTable
			data={data}
			columns={columns}
			customFooter={
				<>
					<TableCell colSpan={5}>Totals</TableCell>
					<TableCell className="text-right px-4">
						{currencyFormatter(totalDebit, false)}
					</TableCell>
					<TableCell className="text-right px-4">
						{currencyFormatter(totalCredit, false)}
					</TableCell>
					<TableCell className="text-right px-4">
						{formatNetAmount(net)}
					</TableCell>
				</>
			}
		/>
	);
}

function formatNetAmount(value: number): string {
	if (value < 0) {
		return `(${currencyFormatter(Math.abs(value), false)})`;
	}

	return currencyFormatter(value, false);
}
