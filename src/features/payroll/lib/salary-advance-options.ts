import { SALARY_ADVANCE_STATUS } from "@/features/payroll/lib/payroll-constants";

export const SALARY_ADVANCE_STATUS_OPTIONS = [
	{ value: SALARY_ADVANCE_STATUS.PENDING, label: "Pending" },
	{ value: SALARY_ADVANCE_STATUS.APPROVED, label: "Approved" },
	{ value: SALARY_ADVANCE_STATUS.DISBURSED, label: "Disbursed" },
	{ value: SALARY_ADVANCE_STATUS.RECOVERING, label: "Recovering" },
	{ value: SALARY_ADVANCE_STATUS.FULLY_RECOVERED, label: "Fully Recovered" },
	{ value: SALARY_ADVANCE_STATUS.REJECTED, label: "Rejected" },
	{ value: SALARY_ADVANCE_STATUS.CANCELLED, label: "Cancelled" },
] as const;

export const SALARY_ADVANCE_ACTIVE_STATUS_OPTIONS = [
	{ value: "pending", label: "Pending Queue" },
	{ value: "active", label: "Active Advances" },
] as const;

export const SALARY_ADVANCE_STATUS_VARIANTS = {
	pending: "warning",
	approved: "secondary",
	disbursed: "success",
	recovering: "success",
	fully_recovered: "outline",
	rejected: "destructive",
	cancelled: "secondary",
} as const;
