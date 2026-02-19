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
		url: "/app/attendances",
		icon: CalendarIcon,
		permission: "attendance:view",
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
				title: "Financial Years",
				url: "/app/financial-years",
				permission: "financial-years:view",
			},
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
			{
				title: "Bills",
				url: "/app/bills",
				permission: "bills:view",
			},
			{
				title: "Expenses",
				url: "/app/expenses",
				permission: "chart-of-accounts",
			},
			{
				title: "Payments",
				url: "/app/payments",
				permission: "payments:view",
			},
			{
				title: "Journal Entries",
				url: "/app/journal-entries",
				permission: "chart-of-accounts",
			},
			{
				title: "Bankings",
				url: "/app/bankings/postings",
				permission: "banking:view",
			},
		],
		get permissions(): Permission[] {
			return this.items.map((item) => item.permission as Permission);
		},
	},
	{
		title: "Reports",
		icon: BarChartIcon,
		items: [
			{
				title: "Member Reports",
				url: "/app/reports/members",
				permission: "members:view",
			},
			{
				title: "Attendance Reports",
				url: "/app/reports/attendance",
				permission: "attendance:view",
			},
			{
				title: "Finance Reports",
				url: "/app/reports/finance",
				permission: "finance:view",
			},
		],
		get permissions(): Permission[] {
			return this.items.map((item) => item.permission as Permission);
		},
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
