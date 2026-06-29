import {
	LOAN_DEFAULT_INTEREST_RATE,
	LOAN_INTEREST_CALCULATION_METHOD,
} from "@/features/payroll/lib/payroll-constants";
import type Big from "big.js";
import { roundDecimal, toBig } from "@/lib/helpers";

type NumericLike = number | string | Big | null | undefined;

export type LoanScheduleItem = {
	instalmentNumber: number;
	principalComponent: number;
	interestComponent: number;
	totalPayment: number;
	balanceAfter: number;
};

export type LoanScheduleComputation = {
	monthlyInstalment: number;
	totalRepayable: number;
	totalInterest: number;
	schedule: LoanScheduleItem[];
};

export type LoanInstalmentBreakdown = {
	principalComponent: number;
	interestComponent: number;
	totalPayment: number;
	balanceAfter: number;
};

function assertValidLoanArguments(
	principal: number,
	annualInterestRate: number,
	instalments: number
) {
	if (!Number.isFinite(principal) || principal <= 0) {
		throw new Error("Principal must be greater than zero");
	}

	if (!Number.isFinite(annualInterestRate) || annualInterestRate < 0 || annualInterestRate > 1) {
		throw new Error("Interest rate must be between 0 and 1");
	}

	if (!Number.isInteger(instalments) || instalments < 1) {
		throw new Error("Instalments must be at least 1");
	}
}

function assertReducingBalanceInterestMethod() {
	if (LOAN_INTEREST_CALCULATION_METHOD !== "reducing_balance") {
		throw new Error(
			`Unsupported loan interest calculation method: ${LOAN_INTEREST_CALCULATION_METHOD}`
		);
	}
}

export function computeLoanSchedule(
	principal: NumericLike,
	annualInterestRate: NumericLike,
	numberOfInstalments: number
): LoanScheduleComputation {
	const parsedPrincipal = roundDecimal(principal);
	const parsedAnnualInterestRate = Number(
		toBig(annualInterestRate ?? LOAN_DEFAULT_INTEREST_RATE).toString()
	);
	const instalments = Number(numberOfInstalments);

	assertValidLoanArguments(parsedPrincipal, parsedAnnualInterestRate, instalments);

	if (parsedAnnualInterestRate === 0) {
		const roundedMonthlyInstalment = roundDecimal(parsedPrincipal / instalments);
		let outstandingBalance = parsedPrincipal;
		const schedule: LoanScheduleItem[] = [];

		for (let instalmentNumber = 1; instalmentNumber <= instalments; instalmentNumber += 1) {
			const isLastInstalment = instalmentNumber === instalments;
			const principalComponent = isLastInstalment
				? roundDecimal(outstandingBalance)
				: roundDecimal(roundedMonthlyInstalment);
			const balanceAfter = roundDecimal(outstandingBalance - principalComponent);

			schedule.push({
				instalmentNumber,
				principalComponent,
				interestComponent: 0,
				totalPayment: principalComponent,
				balanceAfter: balanceAfter < 0 ? 0 : balanceAfter,
			});

			outstandingBalance = balanceAfter < 0 ? 0 : balanceAfter;
		}

		return {
			monthlyInstalment: roundedMonthlyInstalment,
			totalRepayable: roundDecimal(parsedPrincipal),
			totalInterest: 0,
			schedule,
		};
	}

	assertReducingBalanceInterestMethod();

	const principalBig = toBig(parsedPrincipal);
	const monthlyRate = toBig(parsedAnnualInterestRate).div(12);
	const growthFactor = monthlyRate.plus(1).pow(instalments);
	const rawInstalment = principalBig
		.times(monthlyRate.times(growthFactor))
		.div(growthFactor.minus(1));
	const roundedMonthlyInstalment = roundDecimal(rawInstalment);
	let outstandingBalance = parsedPrincipal;
	let totalInterest = 0;
	let totalRepayable = 0;
	const schedule: LoanScheduleItem[] = [];

	for (let instalmentNumber = 1; instalmentNumber <= instalments; instalmentNumber += 1) {
		const isLastInstalment = instalmentNumber === instalments;
		const interestComponent = roundDecimal(toBig(outstandingBalance).times(monthlyRate));
		const principalComponent = isLastInstalment
			? roundDecimal(outstandingBalance)
			: roundDecimal(
					Math.min(outstandingBalance, roundDecimal(roundedMonthlyInstalment - interestComponent))
				);
		const totalPayment = roundDecimal(principalComponent + interestComponent);
		const balanceAfter = isLastInstalment
			? 0
			: roundDecimal(outstandingBalance - principalComponent);

		schedule.push({
			instalmentNumber,
			principalComponent,
			interestComponent,
			totalPayment,
			balanceAfter,
		});

		totalInterest = roundDecimal(totalInterest + interestComponent);
		totalRepayable = roundDecimal(totalRepayable + totalPayment);
		outstandingBalance = balanceAfter;
	}

	return {
		monthlyInstalment: roundedMonthlyInstalment,
		totalRepayable,
		totalInterest,
		schedule,
	};
}

export function computeSingleInstalment(
	outstandingBalance: NumericLike,
	annualInterestRate: NumericLike,
	scheduledMonthlyInstalment?: NumericLike
): LoanInstalmentBreakdown {
	const parsedOutstandingBalance = roundDecimal(outstandingBalance);
	const parsedAnnualInterestRate = Number(
		toBig(annualInterestRate ?? LOAN_DEFAULT_INTEREST_RATE).toString()
	);

	if (!Number.isFinite(parsedOutstandingBalance) || parsedOutstandingBalance <= 0) {
		throw new Error("Outstanding balance must be greater than zero");
	}

	if (
		!Number.isFinite(parsedAnnualInterestRate) ||
		parsedAnnualInterestRate < 0 ||
		parsedAnnualInterestRate > 1
	) {
		throw new Error("Interest rate must be between 0 and 1");
	}

	if (parsedAnnualInterestRate === 0) {
		const totalPayment = roundDecimal(scheduledMonthlyInstalment ?? parsedOutstandingBalance);
		const principalComponent = roundDecimal(Math.min(parsedOutstandingBalance, totalPayment));
		return {
			principalComponent,
			interestComponent: 0,
			totalPayment: principalComponent,
			balanceAfter: roundDecimal(parsedOutstandingBalance - principalComponent),
		};
	}

	assertReducingBalanceInterestMethod();

	const monthlyRate = toBig(parsedAnnualInterestRate).div(12);
	const interestComponent = roundDecimal(toBig(parsedOutstandingBalance).times(monthlyRate));
	const scheduledTotalPayment = roundDecimal(
		scheduledMonthlyInstalment ?? parsedOutstandingBalance + interestComponent
	);
	const cappedTotalPayment = roundDecimal(
		Math.max(
			interestComponent,
			Math.min(scheduledTotalPayment, parsedOutstandingBalance + interestComponent)
		)
	);
	const principalComponent = roundDecimal(
		Math.min(parsedOutstandingBalance, cappedTotalPayment - interestComponent)
	);
	const balanceAfter = roundDecimal(parsedOutstandingBalance - principalComponent);

	return {
		principalComponent,
		interestComponent,
		totalPayment: roundDecimal(principalComponent + interestComponent),
		balanceAfter: balanceAfter < 0 ? 0 : balanceAfter,
	};
}
