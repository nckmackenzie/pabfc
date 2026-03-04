import { linkOptions } from "@tanstack/react-router";
import {
	BanknoteArrowDownIcon,
	BanknoteArrowUpIcon,
	FileTextIcon,
	HandshakeIcon,
	LandmarkIcon,
	ListIcon,
	TrendingUpIcon,
} from "lucide-react";

export const RECEIPTS_REPORT_TYPE = [
	{ label: "All Receipts", value: "all" },
	{ label: "By Member", value: "by-member" },
] as const;

export const EXPENSES_REPORT_TYPE = [
	{ label: "All", value: "all" },
	{ label: "By Expense Account", value: "by-expense-account" },
	{ label: "By Payee", value: "by-payee" },
] as const;

export const INVOICES_REPORT_TYPE = [
	{ label: "All", value: "all" },
	{ label: "Overdue", value: "overdue" },
	{ label: "Vendor Spend Summary", value: "vendor-spend-summary" },
	{ label: "Ageing Summary", value: "ageing-summary" },
] as const;

export const BANKING_REPORT_TYPE = [
	{ label: "All", value: "all" },
	{ label: "By Status", value: "by-status" },
] as const;

export const BANKING_REPORT_STATUS = [
	{ label: "Cleared", value: "cleared" },
	{ label: "Uncleared", value: "uncleared" },
	{ label: "Both", value: "both" },
] as const;

export const REPORT_CARDS = linkOptions([
	{
		to: "/app/reports/finance/receipts",
		title: "Receipts Report",
		description: "Report for all payments received.",
		icon: BanknoteArrowUpIcon,
		permission: "reports:receipts-report",
	},
	{
		to: "/app/reports/finance/expenses",
		title: "Expenses Report",
		description: "Report for all expenses.",
		icon: BanknoteArrowDownIcon,
		permission: "reports:expenses-report",
	},
	{
		to: "/app/reports/finance/invoices",
		title: "Invoices Report",
		description: "Report for all invoices.",
		icon: FileTextIcon,
		permission: "reports:invoices-report",
	},
	{
		to: "/app/reports/finance/banking",
		title: "Banking Report",
		description: "Report for all bank transactions.",
		icon: LandmarkIcon,
		permission: "reports:bankings-report",
	},
	{
		to: "/app/reports/finance/payments",
		title: "Payments Report",
		description: "Report for supplier payments.",
		icon: HandshakeIcon,
		permission: "reports:payments-report",
	},
	{
		to: "/app/reports/finance/income-statement",
		title: "Income Statement",
		description: "Report for all income and expenses.",
		icon: TrendingUpIcon,
		permission: "reports:income-statement",
	},
	{
		to: "/app/reports/finance/trial-balance",
		title: "Trial Balance",
		description: "Verify ledger debits and credits.",
		icon: ListIcon,
		permission: "reports:trial-balance",
	},
]);
