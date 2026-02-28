"use no memo";

import type {
	ColumnDef,
	Table as ReactTable,
	SortingState,
} from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import React from "react";
import { Button } from "@/components/ui/button";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	ChevronsLeftIcon,
	ChevronsRightIcon,
} from "@/components/ui/icons";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useExportToCsv } from "@/hooks/use-export-to-csv";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
	columns: Array<ColumnDef<TData, TValue>>;
	data: Array<TData>;
	denseCell?: boolean;
	withPaginationButtons?: boolean;
	customFooter?: React.ReactNode;
	exportToExcel?: boolean;
	exportFileName?: string;
}

export function DataTable<TData, TValue>({
	columns,
	data,
	withPaginationButtons = true,
	denseCell = false,
	customFooter,
	exportToExcel = false,
	exportFileName = "datatable-export.csv",
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const { exportToCsv } = useExportToCsv();

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		state: {
			sorting,
		},
	});

	const getHeaderLabel = React.useCallback(
		(header: ReturnType<typeof flexRender>, fallback: string) => {
			if (typeof header === "string" || typeof header === "number") {
				return String(header);
			}
			if (React.isValidElement(header)) {
				// @ts-expect-error
				const title = header.props?.title;
				if (typeof title === "string" || typeof title === "number") {
					return String(title);
				}
			}
			return fallback;
		},
		[],
	);

	const getValueFromAccessorKey = React.useCallback(
		(row: TData, accessorKey: string) =>
			accessorKey.split(".").reduce((value, key) => {
				if (value && typeof value === "object" && key in value) {
					return (value as Record<string, unknown>)[key];
				}
				return undefined;
			}, row as unknown),
		[],
	);

	const exportableColumns = React.useMemo(() => {
		return table.getAllLeafColumns().filter(
			(column) =>
				column.getIsVisible() && // @ts-expect-error
				(column.columnDef.accessorKey || column.columnDef.accessorFn),
		);
	}, [table]);

	const exportHeaders = React.useMemo(() => {
		const headerMap = new Map<string, string>();
		table.getHeaderGroups().forEach((group) => {
			group.headers.forEach((header) => {
				if (header.isPlaceholder) {
					return;
				}
				const rendered = flexRender(
					header.column.columnDef.header,
					header.getContext(),
				);
				const label = getHeaderLabel(rendered, header.column.id);
				headerMap.set(header.column.id, label);
			});
		});
		return headerMap;
	}, [getHeaderLabel, table]);

	const handleExport = React.useCallback(() => {
		const exportData = data.map((row, index) => {
			const record: Record<string, unknown> = {};
			exportableColumns.forEach((column) => {
				const headerLabel = exportHeaders.get(column.id) ?? column.id;
				// @ts-expect-error
				if (column.columnDef.accessorFn) {
					// @ts-expect-error
					record[headerLabel] = column.columnDef.accessorFn(row, index);
					return;
				}
				// @ts-expect-error
				const accessorKey = column.columnDef.accessorKey;
				if (typeof accessorKey === "string") {
					record[headerLabel] = getValueFromAccessorKey(row, accessorKey);
					return;
				}
				if (accessorKey) {
					// @ts-expect-error
					record[headerLabel] = (row as Record<string, unknown>)[
						accessorKey as keyof TData
					];
				}
			});
			return record;
		});

		exportToCsv(exportData, exportFileName);
	}, [
		data,
		exportFileName,
		exportHeaders,
		exportToCsv,
		exportableColumns,
		getValueFromAccessorKey,
	]);

	return (
		<>
			{exportToExcel && (
				<div className="flex justify-end mb-2">
					<Button variant="outline" size="sm" onClick={handleExport}>
						Export to Excel
					</Button>
				</div>
			)}
			<div className="rounded-md border overflow-x-auto bg-card">
				<Table>
					<TableHeader className="bg-secondary">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id} className="h-12 px-4 text-sm">
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={cn("p-4", { "px-4 py-2": denseCell })}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
					{customFooter && table.getRowModel().rows.length && (
						<TableFooter>
							<TableRow>{customFooter}</TableRow>
						</TableFooter>
					)}
				</Table>
			</div>
			{withPaginationButtons && <DataTablePagination table={table} />}
		</>
	);
}

interface DataTablePaginationProps<TData> {
	table: ReactTable<TData>;
}

export function DataTablePagination<TData>({
	table,
}: DataTablePaginationProps<TData>) {
	return (
		<div className="flex items-center justify-between px-2 mt-2">
			<div className="flex items-center space-x-6 lg:space-x-8">
				<div className="flex items-center space-x-2">
					<p className="text-sm font-medium">Rows per page</p>
					<Select
						value={`${table.getState().pagination.pageSize}`}
						onValueChange={(value) => {
							table.setPageSize(Number(value));
						}}
					>
						<SelectTrigger className="h-8 w-[70px]">
							<SelectValue placeholder={table.getState().pagination.pageSize} />
						</SelectTrigger>
						<SelectContent side="top">
							{[10, 20, 25, 30, 40, 50].map((pageSize) => (
								<SelectItem key={pageSize} value={`${pageSize}`}>
									{pageSize}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex w-[100px] items-center justify-center text-sm font-medium">
					Page {table.getState().pagination.pageIndex + 1} of{" "}
					{table.getPageCount()}
				</div>
				<div className="flex items-center space-x-2">
					<Button
						variant="outline"
						size="icon"
						className="hidden size-8 lg:flex"
						onClick={() => table.setPageIndex(0)}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">Go to first page</span>
						<ChevronsLeftIcon />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						<span className="sr-only">Go to previous page</span>
						<ArrowLeftIcon />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">Go to next page</span>
						<ArrowRightIcon />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="hidden size-8 lg:flex"
						onClick={() => table.setPageIndex(table.getPageCount() - 1)}
						disabled={!table.getCanNextPage()}
					>
						<span className="sr-only">Go to last page</span>
						<ChevronsRightIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}
