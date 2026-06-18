import { roundPayrollAmount } from "@/features/payroll/lib/helpers";

export function computeSalaryAdvanceMonthlyRecoveryAmount(
	approvedAmount: number,
	approvedRecoveryMonths: number
) {
	return roundPayrollAmount(approvedAmount / approvedRecoveryMonths);
}

export function computeSalaryAdvanceRecoveryStep({
	approvedRecoveryMonths,
	monthlyRecoveryAmount,
	outstandingBalance,
	recoveriesProcessed,
}: {
	approvedRecoveryMonths: number;
	monthlyRecoveryAmount: number;
	outstandingBalance: number;
	recoveriesProcessed: number;
}) {
	const isLastRecovery =
		recoveriesProcessed + 1 >= approvedRecoveryMonths ||
		outstandingBalance <= monthlyRecoveryAmount;
	const recoveryAmount = isLastRecovery ? outstandingBalance : monthlyRecoveryAmount;
	const balanceAfter = roundPayrollAmount(outstandingBalance - recoveryAmount);

	return {
		balanceAfter: balanceAfter <= 0 ? 0 : balanceAfter,
		isLastRecovery,
		recoveryAmount,
	};
}
