import { OVERTIME_STATUS } from "@/features/payroll/lib/payroll-constants";

export const PAYROLL_MONTH_OPTIONS = [
	{ value: 1, label: "January" },
	{ value: 2, label: "February" },
	{ value: 3, label: "March" },
	{ value: 4, label: "April" },
	{ value: 5, label: "May" },
	{ value: 6, label: "June" },
	{ value: 7, label: "July" },
	{ value: 8, label: "August" },
	{ value: 9, label: "September" },
	{ value: 10, label: "October" },
	{ value: 11, label: "November" },
	{ value: 12, label: "December" },
] as const;

export const OVERTIME_STATUS_OPTIONS = [
	{ value: OVERTIME_STATUS.DRAFT, label: "Draft" },
	{ value: OVERTIME_STATUS.APPROVED, label: "Approved" },
	{ value: OVERTIME_STATUS.PAID, label: "Paid" },
] as const;

export function formatPayrollPeriod(periodMonth: number, periodYear: number) {
	const monthLabel =
		PAYROLL_MONTH_OPTIONS.find((option) => option.value === periodMonth)?.label ??
		`Month ${periodMonth}`;

	return `${monthLabel} ${periodYear}`;
}

export function getPayrollYearOptions({
	startYear = 2020,
	endYear = new Date().getUTCFullYear(),
}: {
	startYear?: number;
	endYear?: number;
} = {}) {
	return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
		const year = endYear - index;
		return {
			value: year,
			label: String(year),
		};
	});
}
