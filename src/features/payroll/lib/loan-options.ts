import { LOAN_STATUS } from "@/features/payroll/lib/payroll-constants";

export const LOAN_STATUS_OPTIONS = [
	{ value: LOAN_STATUS.PENDING, label: "Pending" },
	{ value: LOAN_STATUS.ACTIVE, label: "Active" },
	{ value: LOAN_STATUS.PAUSED, label: "Paused" },
	{ value: LOAN_STATUS.FULLY_PAID, label: "Fully Paid" },
	{ value: LOAN_STATUS.WRITTEN_OFF, label: "Written Off" },
	{ value: LOAN_STATUS.REJECTED, label: "Rejected" },
] as const;

export const LOAN_STATUS_VARIANTS = {
	pending: "warning",
	active: "success",
	paused: "secondary",
	fully_paid: "outline",
	written_off: "destructive",
	rejected: "destructive",
} as const;

export function getLoanStatusVariant(status: string) {
	return LOAN_STATUS_VARIANTS[status as keyof typeof LOAN_STATUS_VARIANTS];
}
