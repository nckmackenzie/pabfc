import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	type ExpandedState,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { EditAction } from "@/components/ui/custom-button";
import { DatatableActions } from "@/components/ui/datatable-actions";
import { DeleteActionButton } from "@/components/ui/delete-action";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AccountType } from "@/drizzle/schema";
import { useFilters } from "@/hooks/use-filters";
import { toTitleCase } from "@/lib/utils";
import { deleteAccount } from "../services/coa.api";
import { accountQueries } from "../services/queries";

export type LedgerAccount = {
	id: number;
	code: string | null;
	name: string;
	parentId: number | null;
	type: AccountType;
	children?: LedgerAccount[];
};

export function buildAccountTree(accounts: LedgerAccount[]): LedgerAccount[] {
	const accountMap = new Map<number, LedgerAccount>();
	const rootAccounts: LedgerAccount[] = [];

	accounts.forEach((account) => {
		accountMap.set(account.id, { ...account, children: [] });
	});

	accounts.forEach((account) => {
		// biome-ignore lint/style/noNonNullAssertion: <>
		const node = accountMap.get(account.id)!;

		if (account.parentId) {
			const parent = accountMap.get(account.parentId);
			if (parent) {
				parent.children?.push(node);
			} else {
				// Handle orphan records or root if parent not found
				rootAccounts.push(node);
			}
		} else {
			rootAccounts.push(node);
		}
	});

	return rootAccounts;
}

export const ChartOfAccountsTable = () => {
	const { filters } = useFilters(getRouteApi("/app/chart-of-accounts/").id);
	const { data: rawData } = useSuspenseQuery(accountQueries.list(filters));
	const data = useMemo(() => buildAccountTree(rawData), [rawData]);

	const [expanded, setExpanded] = useState<ExpandedState>({});
	const columns = useMemo<ColumnDef<LedgerAccount>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Account Name",
				cell: ({ row, getValue }) => (
					<div
						style={{
							// Indent based on depth: 0px, 20px, 40px, etc.
							paddingLeft: `${row.depth * 2}rem`,
						}}
						className="flex items-center gap-2"
					>
						{/* The Expander Button */}
						{row.getCanExpand() ? (
							<button
								onClick={row.getToggleExpandedHandler()}
								style={{ cursor: "pointer" }}
								type="button"
							>
								{row.getIsExpanded() ? "▼" : "▶"}
							</button>
						) : (
							// Spacer for non-expandable rows to align text
							<span className="w-4 inline-block" />
						)}
						{getValue<string>()}
					</div>
				),
			},
			{
				accessorKey: "type",
				header: "Type",
				cell: ({ row }) => toTitleCase(row.original.type),
			},
			{
				id: "actions",
				cell: ({
					row: {
						original: { id },
					},
				}) => (
					<DatatableActions>
						<PermissionGate
							permission="chart-of-accounts:update"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DropdownMenuItem asChild>
								<Link
									to="/app/chart-of-accounts/$accountId/edit"
									params={{ accountId: id.toString() }}
								>
									<EditAction />
								</Link>
							</DropdownMenuItem>
						</PermissionGate>
						<PermissionGate
							permission="chart-of-accounts:delete"
							loadingComponent={<Skeleton className="h-4 w-56" />}
						>
							<DeleteActionButton
								deleteAction={deleteAccount}
								resourceId={id.toString()}
								queryKey={["accounts"]}
							/>
						</PermissionGate>
					</DatatableActions>
				),
			},
		],
		[],
	);

	// 4. Initialize Table
	const table = useReactTable({
		data,
		columns,
		state: {
			expanded,
		},
		onExpandedChange: setExpanded,
		getSubRows: (row) => row.children,
		getCoreRowModel: getCoreRowModel(),
		getExpandedRowModel: getExpandedRowModel(), // Required for tree view
		debugTable: true,
	});

	return (
		<div className="rounded-md border overflow-x-auto bg-card">
			<Table className="w-full text-left border-collapse">
				<TableHeader className="bg-secondary">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="border-b bg-gray-50">
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									className="p-2 font-semibold text-sm text-gray-600"
								>
									{header.isPlaceholder
										? null
										: flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow key={row.id} className="border-b hover:bg-gray-50">
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id} className="p-2">
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
};
