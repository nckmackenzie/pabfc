import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import type { z } from "zod";
import { DataTable } from "@/components/ui/datatable";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { Search } from "@/components/ui/search";
import { TableCell } from "@/components/ui/table";
import type { bankPostings } from "@/drizzle/schema";
import { bankPostingQueries } from "@/features/bankings/services/queries";
import type { bankReconciliationFormSchema } from "@/features/bankings/services/schema";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const columns: Array<ColumnDef<typeof bankPostings.$inferSelect>> = [
	{
		accessorKey: "transactionDate",
		header: "Date",
		cell: ({ row }) => dateFormat(row.original.transactionDate, "reporting"),
	},
	{
		accessorKey: "narration",
		header: "Description",
	},
	{
		accessorKey: "reference",
		header: "Reference",
		cell: ({ row }) => row.original.reference?.toUpperCase() || undefined,
	},
	{
		accessorKey: "source",
		header: "Source",
		cell: ({ row }) => toTitleCase(row.original.source as string),
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.amount, false, false, true)}
			</div>
		),
	},
];

export function UnclearedTransactionByType({
	filters,
	type,
}: {
	filters: z.infer<typeof bankReconciliationFormSchema>;
	type: "deposit" | "withdrawal";
}) {
	const [search, setSearch] = useState("");
	const { data, isLoading, error } = useQuery(
		bankPostingQueries.unclearedByTransaction({
			...filters,
			type: type === "deposit" ? "debit" : "credit",
			q: search,
		}),
	);

	if (isLoading) return <DatatableSkeleton />;
	if (error) return <AlertErrorComponent message={error.message} />;

	return (
		<div className="space-y-4 px-4">
			<Search
				defaultValue={search}
				placeholder="Search by description"
				onHandleSearch={(val) => setSearch(val)}
			/>
			<DataTable
				columns={columns}
				data={data || []}
				customFooter={
					<>
						<TableCell colSpan={4}>Total:</TableCell>
						<TableCell className="text-right font-semibold">
							{currencyFormatter(
								data?.reduce((acc, curr) => acc + parseFloat(curr.amount), 0) ||
									0,
							)}
						</TableCell>
					</>
				}
			/>
		</div>
	);
}
