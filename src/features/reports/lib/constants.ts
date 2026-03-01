import { linkOptions } from "@tanstack/react-router";
import { BanknoteArrowDownIcon, BanknoteArrowUpIcon } from "lucide-react";

export const RECEIPTS_REPORT_TYPE = [
	{ label: "All Receipts", value: "all" },
	{ label: "By Member", value: "by-member" },
] as const;

export const EXPENSES_REPORT_TYPE = [
	{ label: "All", value: "all" },
	{ label: "By Expense Account", value: "by-expense-account" },
	{ label: "By Payee", value: "by-payee" },
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
]);
