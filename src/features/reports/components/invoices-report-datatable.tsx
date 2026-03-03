import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/datatable";
import { TableCell } from "@/components/ui/table";
import { getInvoicesReport } from "@/features/reports/services/invoices.api";
import type { InvoiceReportFormSchema } from "@/features/reports/services/schema";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat, toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type ReportType = InvoiceReportFormSchema["reportType"];

type AllInvoicesRow = {
	invoiceDate: string;
	vendor: string;
	invoiceNo: string;
	amount: string;
	amountPaid: string;
	balance: string;
};

type VendorSpendSummaryRow = {
	vendor: string;
	totalInvoices: number;
	totalAmount: string;
	totalAmountPaid: string;
	totalBalance: string;
};

type OverdueRow = {
	vendor: string;
	invoiceNo: string;
	dueDate: string;
	daysOverdue: number;
	amount: string;
	balance: string;
};

type AgeingSummaryRow = {
	vendor: string;
	current: string;
	days1To30: string;
	days31To60: string;
	days61To90: string;
	days90Plus: string;
	total: string;
};

const allColumns: Array<ColumnDef<AllInvoicesRow>> = [
	{
		accessorKey: "invoiceDate",
		header: "Invoice Date",
		cell: ({ row }) => dateFormat(row.original.invoiceDate, "reporting"),
	},
	{
		accessorKey: "vendor",
		header: "Vendor",
		cell: ({ row }) => toTitleCase(row.original.vendor),
	},
	{
		accessorKey: "invoiceNo",
		header: "Invoice No",
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.amount, false)}
			</div>
		),
	},
	{
		accessorKey: "amountPaid",
		header: () => <div className="text-right">Amount Paid</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.amountPaid, false)}
			</div>
		),
	},
	{
		accessorKey: "balance",
		header: () => <div className="text-right">Balance</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.balance, false)}
			</div>
		),
	},
];

const vendorSummaryColumns: Array<ColumnDef<VendorSpendSummaryRow>> = [
	{
		accessorKey: "vendor",
		header: "Vendor",
		cell: ({ row }) => toTitleCase(row.original.vendor),
	},
	{
		accessorKey: "totalInvoices",
		header: () => <div className="text-right">Total Invoices</div>,
		cell: ({ row }) => (
			<div className="text-right">{row.original.totalInvoices}</div>
		),
	},
	{
		accessorKey: "totalAmount",
		header: () => <div className="text-right">Total Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.totalAmount, false)}
			</div>
		),
	},
	{
		accessorKey: "totalAmountPaid",
		header: () => <div className="text-right">Total Amount Paid</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.totalAmountPaid, false)}
			</div>
		),
	},
	{
		accessorKey: "totalBalance",
		header: () => <div className="text-right">Total Balance</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.totalBalance, false)}
			</div>
		),
	},
];

const overdueColumns: Array<ColumnDef<OverdueRow>> = [
	{
		accessorKey: "vendor",
		header: "Vendor",
		cell: ({ row }) => toTitleCase(row.original.vendor),
	},
	{
		accessorKey: "invoiceNo",
		header: "Invoice No",
	},
	{
		accessorKey: "dueDate",
		header: "Due Date",
		cell: ({ row }) => dateFormat(row.original.dueDate, "reporting"),
	},
	{
		accessorKey: "daysOverdue",
		header: () => <div className="text-right">Days Overdue</div>,
		cell: ({ row }) => (
			<div className="text-right">{row.original.daysOverdue}</div>
		),
	},
	{
		accessorKey: "amount",
		header: () => <div className="text-right">Amount</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.amount, false)}
			</div>
		),
	},
	{
		accessorKey: "balance",
		header: () => <div className="text-right">Balance</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.balance, false)}
			</div>
		),
	},
];

const ageingSummaryColumns: Array<ColumnDef<AgeingSummaryRow>> = [
	{
		accessorKey: "vendor",
		header: "Vendor",
		cell: ({ row }) => toTitleCase(row.original.vendor),
	},
	{
		accessorKey: "current",
		header: () => <div className="text-right">Current</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.current, false)}
			</div>
		),
	},
	{
		accessorKey: "days1To30",
		header: () => <div className="text-right">1-30 Days</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.days1To30, false)}
			</div>
		),
	},
	{
		accessorKey: "days31To60",
		header: () => <div className="text-right">31-60 Days</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.days31To60, false)}
			</div>
		),
	},
	{
		accessorKey: "days61To90",
		header: () => <div className="text-right">61-90 Days</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.days61To90, false)}
			</div>
		),
	},
	{
		accessorKey: "days90Plus",
		header: () => <div className="text-right">90+ Days</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.days90Plus, false)}
			</div>
		),
	},
	{
		accessorKey: "total",
		header: () => <div className="text-right">Total</div>,
		cell: ({ row }) => (
			<div className="text-right">
				{currencyFormatter(row.original.total, false)}
			</div>
		),
	},
];

export function InvoicesReportDataTable() {
	const { filters } = useFilters(
		getRouteApi("/app/reports/finance/invoices/").id,
	);
	const { data } = useSuspenseQuery({
		queryKey: ["reports", "invoices", filters],
		queryFn: () =>
			getInvoicesReport({
				data: filters as InvoiceReportFormSchema,
			}),
	});

	switch (filters.reportType as ReportType) {
		case "all": {
			const rows = data as Array<AllInvoicesRow>;
			const totals = rows.reduce(
				(acc, row) => {
					acc.amount += toNumber(row.amount);
					acc.amountPaid += toNumber(row.amountPaid);
					acc.balance += toNumber(row.balance);
					return acc;
				},
				{ amount: 0, amountPaid: 0, balance: 0 },
			);

			return (
				<DataTable
					columns={allColumns}
					data={rows}
					exportToExcel
					customFooter={
						<>
							<TableCell colSpan={3} className="font-semibold text-center">
								Totals:
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.amount, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.amountPaid, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.balance, false)}
							</TableCell>
						</>
					}
				/>
			);
		}
		case "vendor-spend-summary": {
			const rows = data as Array<VendorSpendSummaryRow>;
			const totals = rows.reduce(
				(acc, row) => {
					acc.totalInvoices += Number(row.totalInvoices);
					acc.totalAmount += toNumber(row.totalAmount);
					acc.totalAmountPaid += toNumber(row.totalAmountPaid);
					acc.totalBalance += toNumber(row.totalBalance);
					return acc;
				},
				{
					totalInvoices: 0,
					totalAmount: 0,
					totalAmountPaid: 0,
					totalBalance: 0,
				},
			);

			return (
				<DataTable
					columns={vendorSummaryColumns}
					data={rows}
					exportToExcel
					customFooter={
						<>
							<TableCell className="font-semibold text-center">
								Totals:
							</TableCell>
							<TableCell className="font-semibold text-right">
								{totals.totalInvoices}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.totalAmount, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.totalAmountPaid, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.totalBalance, false)}
							</TableCell>
						</>
					}
				/>
			);
		}
		case "overdue": {
			const rows = data as Array<OverdueRow>;
			const totals = rows.reduce(
				(acc, row) => {
					acc.amount += Number.parseFloat(row.amount);
					acc.balance += Number.parseFloat(row.balance);
					return acc;
				},
				{ amount: 0, balance: 0 },
			);

			return (
				<DataTable
					columns={overdueColumns}
					data={rows}
					exportToExcel
					customFooter={
						<>
							<TableCell colSpan={4} className="font-semibold text-center">
								Totals:
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.amount, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.balance, false)}
							</TableCell>
						</>
					}
				/>
			);
		}
		case "ageing-summary": {
			const rows = data as Array<AgeingSummaryRow>;
			const totals = rows.reduce(
				(acc, row) => {
					acc.current += Number.parseFloat(row.current);
					acc.days1To30 += Number.parseFloat(row.days1To30);
					acc.days31To60 += Number.parseFloat(row.days31To60);
					acc.days61To90 += Number.parseFloat(row.days61To90);
					acc.days90Plus += Number.parseFloat(row.days90Plus);
					acc.total += Number.parseFloat(row.total);
					return acc;
				},
				{
					current: 0,
					days1To30: 0,
					days31To60: 0,
					days61To90: 0,
					days90Plus: 0,
					total: 0,
				},
			);

			return (
				<DataTable
					columns={ageingSummaryColumns}
					data={rows}
					exportToExcel
					customFooter={
						<>
							<TableCell className="font-semibold text-center">
								Totals:
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.current, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.days1To30, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.days31To60, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.days61To90, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.days90Plus, false)}
							</TableCell>
							<TableCell className="font-semibold text-right px-4">
								{currencyFormatter(totals.total, false)}
							</TableCell>
						</>
					}
				/>
			);
		}
		default:
			return null;
	}
}
