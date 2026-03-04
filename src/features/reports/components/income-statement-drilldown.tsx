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
import { getIncomeStatementDrillDown } from "@/features/reports/services/income-statement.api";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type DrillDowmItem = Awaited<
	ReturnType<typeof getIncomeStatementDrillDown>
>[number];

const columns: Array<ColumnDef<DrillDowmItem>> = [
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
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{formatDrilldownAmount(toNumber(row.original.amount))}
			</div>
		),
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
];

export function IncomeStatementDrillDown({
	id,
	dateFrom,
	dateTo,
}: {
	id: number;
	dateFrom: string;
	dateTo: string;
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
				<DrilldownTable
					id={id}
					dateFrom={dateFrom}
					dateTo={dateTo}
					search={search}
				/>
			</ErrorBoundaryWithSuspense>
		</div>
	);
}

function DrilldownTable({
	id,
	dateFrom,
	dateTo,
	search,
}: {
	id: number;
	dateFrom: string;
	dateTo: string;
	search?: string;
}) {
	const { data } = useSuspenseQuery({
		queryKey: ["income-statement-drilldown", { id, dateFrom, dateTo, search }],
		queryFn: () =>
			getIncomeStatementDrillDown({
				data: { id, dateFrom, dateTo, q: search },
			}),
	});

	const total = data.reduce((acc, item) => acc + toNumber(item.amount), 0);

	if (data.length === 0)
		return (
			<EmptyState
				icon={search ? <SearchIcon /> : undefined}
				title="No Transactions"
				description={`No transactions found ${search ? `matching ${search}` : " for selected account"}`}
			/>
		);
	return (
		<DataTable
			data={data}
			columns={columns}
			customFooter={
				<>
					<TableCell colSpan={3}>Totals</TableCell>
					<TableCell className="text-right px-4">
						{formatDrilldownAmount(total)}
					</TableCell>
					<TableCell colSpan={2} />
				</>
			}
		/>
	);
}

function formatDrilldownAmount(value: number): string {
	if (value < 0) {
		return `(${currencyFormatter(Math.abs(value), false)})`;
	}

	return currencyFormatter(value, false);
}
