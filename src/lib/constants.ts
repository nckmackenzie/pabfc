import {
	BarChartIcon,
	CalendarIcon,
	ChartPieIcon,
	ChatMessageIcon,
	DollarSignIcon,
	PercentBadgeIcon,
	Users2Icon,
	UsersIcon,
} from "@/components/ui/icons";
import type { Permission } from "@/lib/permissions/constants";

export const DEFAULT_PAGE_INDEX = 0;
export const DEFAULT_PAGE_SIZE = 10;

export type MenuItem = {
	title: string;
	url: string;
	icon: React.ComponentType<{ className?: string }>;
	permission?: Permission;
	wip?: boolean;
};

export const menuItems: MenuItem[] = [
	{
		title: "Dashboard",
		url: "/app/dashboard",
		icon: ChartPieIcon,
	},
	{
		title: "User Management",
		url: "/app/users",
		icon: UsersIcon,
	},
	{
		title: "Member Management",
		url: "/app/members",
		icon: Users2Icon,
		permission: "members:view",
	},
	{
		title: "Plans & Packages",
		url: "/app/plans",
		icon: PercentBadgeIcon,
	},
	{
		title: "Attendance",
		url: "/app/attendance",
		icon: CalendarIcon,
		wip: true,
	},
	{
		title: "Communication",
		url: "/app/communication",
		icon: ChatMessageIcon,
		permission: "communication:view",
	},
];

export const collapsibleMenuItems = [
	{
		title: "Finance",
		icon: DollarSignIcon,
		items: [
			{
				title: "Chart of Accounts",
				url: "/app/chart-of-accounts",
				permission: "chart-of-accounts:view",
			},
			{
				title: "Receipts",
				url: "/app/receipts",
				permission: "receipts:view",
			},
			// {
			// 	title: "Invoices",
			// 	url: "/app/invoices",
			// 	permission: "invoices:view",
			// },
			{
				title: "Expenses",
				url: "/app/expenses",
				permission: "chart-of-accounts",
			},
			{
				title: "Jounal Entries",
				url: "/app/journal-entries",
				permission: "chart-of-accounts",
			},
		],
	},
	{
		title: "Reports",
		icon: BarChartIcon,
		items: [
			{
				title: "Member Reports",
				url: "/app/reports/members",
			},
			{
				title: "Attendance Reports",
				url: "/app/reports/attendance",
			},
			{
				title: "Finance Reports",
				url: "/app/reports/finance",
			},
		],
	},
];

export const PAYMENT_METHODS = [
	{
		value: "cash",
		label: "Cash",
	},
	{
		value: "mpesa",
		label: "M-Pesa",
	},
	{
		value: "cheque",
		label: "Cheque",
	},
	{
		value: "bank",
		label: "Bank",
	},
];
