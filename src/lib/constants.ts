import {
	BarChartIcon,
	CalendarIcon,
	ChartPieIcon,
	ChatMessageIcon,
	DollarSignIcon,
	PercentBadgeIcon,
	Users2Icon,
	UsersIcon,
	UserKeyIcon,
} from "@/components/ui/icons";
import type { Permission } from "@/lib/permissions/constants";
import type { Route } from "@/types/index.types";

export const DEFAULT_PAGE_INDEX = 0;
export const DEFAULT_PAGE_SIZE = 10;

export type MenuItem = {
	title: string;
	url: string;
	icon: React.ComponentType<{ className?: string }>;
	permission?: Permission;
	wip?: boolean;
};

interface CollapsibleSubMenuItem {
	title: string;
	url: Route;
	permission: Permission | Permission[];
}

interface CollapsibleMenuItem {
	title: string;
	icon: typeof DollarSignIcon; // or whatever icon component type you use elsewhere
	items: CollapsibleSubMenuItem[];
	readonly permissions: Permission[];
}

export const menuItems: MenuItem[] = [
	{
		title: "Dashboard",
		url: "/app/dashboard",
		icon: ChartPieIcon,
		permission: "dashboard:view",
	},
	{
		title: "User Management",
		url: "/app/users",
		icon: UserKeyIcon,
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
		permission: "plans:view",
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

export const collapsibleMenuItems: CollapsibleMenuItem[] = [
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
				permission: "expenses:view",
			},
			{
				title: "Payments",
				url: "/app/payments",
				permission: "payments:view",
			},
			{
				title: "Journal Entries",
				url: "/app/journal-entries",
				permission: "journal-entries:view",
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
		title: "HR & Payroll",
		icon: UsersIcon,
		items: [
			{
				title: "Employees",
				url: "/app/employees",
				permission: "employees:view",
			},
			{
				title: "Leave Management",
				url: "/app/leaves",
				permission: "leaves:view",
			},
			{
				title: "Employee Loans",
				url: "/app/payroll/loans",
				permission: "employee-loans:view",
			},
			{
				title: "Payroll Account Mappings",
				url: "/app/payroll/account-mappings",
				permission: "payroll-account-mappings:view",
			},
			{
				title: "Statutory Rates",
				url: "/app/payroll/statutory-rates",
				permission: "statutory-rates:view",
			},
			{
				title: "Salary Structures",
				url: "/app/payroll/salary-structures",
				permission: "salary-structures:view",
			},
			{
				title: "Salary Advances",
				url: "/app/payroll/salary-advances",
				permission: "salary-advances:view",
			},
			{
				title: "Overtime Records",
				url: "/app/payroll/overtime",
				permission: "overtime-records:view",
			},
			{
				title: "Payroll Periods",
				url: "/app/payroll/periods",
				permission: "payroll-periods:view",
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
				permission: [
					"reports:receipts-report",
					"reports:expenses-report",
					"reports:invoices-report",
					"reports:bankings-report",
					"reports:payments-report",
					"reports:income-statement",
					"reports:trial-balance",
					"reports:balance-sheet",
				],
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
