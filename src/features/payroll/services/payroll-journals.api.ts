import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import {
	journalEntries,
	journalLines,
	ledgerAccounts,
	payrollPeriods,
	payrollSlips,
	type AccountType,
} from "@/drizzle/schema";
import {
	buildRemittanceCompletionStatus,
	buildRemittanceLineMemo,
	getJournalBalanceSummary,
	parseRemittanceLineMemoType,
	type PayrollRecognitionTotals,
	type RemittanceCompletionStatus,
} from "@/features/payroll/lib/payroll-journal-helpers";
import {
	PAYROLL_JOURNAL_SOURCES,
	PAYROLL_PERIOD_STATUS,
	PAYROLL_REMITTANCE_ITEM_TYPES,
	type PayrollAccountRole,
	type PayrollRemittanceItemType,
} from "@/features/payroll/lib/payroll-constants";
import { toNumber } from "@/lib/helpers";
import { roundPayrollAmount, toPayrollDecimalString } from "@/features/payroll/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import {
	getAccountMappingsAsMapFn,
	// validateAllMappingsExist,
} from "@/features/payroll/services/account-mappings.api";
import {
	payrollJournalEntryIdSchema,
	payrollJournalPeriodIdSchema,
	salaryDisbursementJournalSchema,
	statutoryRemittanceJournalSchema,
} from "@/features/payroll/services/payroll-journal.schemas";
import type { Transaction } from "./payroll-slips.api";
import { todayIsoDate } from "@/features/leaves/utils/helpers";

type PayrollPeriodRecord = typeof payrollPeriods.$inferSelect;
type JournalEntryRecord = typeof journalEntries.$inferSelect;
type JournalLineRecord = typeof journalLines.$inferSelect;
type LedgerAccountRecord = typeof ledgerAccounts.$inferSelect;

type PayrollJournalSummaryEntry = {
	id: number;
	postedAt: string;
	totalDebits: number;
	totalCredits: number;
};

export type PayrollRemittanceSummaryItem = {
	type: PayrollRemittanceItemType;
	amountRemitted: number;
};

export type PayrollDisbursementJournalSummary = {
	id: number;
	postedAt: string;
	amount: number;
	disbursementAccount: {
		id: number;
		code: string | null;
		name: string;
	} | null;
};

export type PayrollRemittanceJournalSummary = {
	id: number;
	postedAt: string;
	itemsRemitted: PayrollRemittanceSummaryItem[];
	totalAmount: number;
};

export type PayrollJournalSummary = {
	recognitionJournal: PayrollJournalSummaryEntry | null;
	disbursementJournal: PayrollDisbursementJournalSummary | null;
	remittanceJournals: PayrollRemittanceJournalSummary[];
	remittanceCompletionStatus: RemittanceCompletionStatus;
	allJournalsComplete: boolean;
};

export type JournalEntryWithLines = {
	id: number;
	entryDate: string;
	reference: string | null;
	description: string | null;
	source: string | null;
	sourceId: string | null;
	journalNo: number | null;
	createdAt: Date;
	updatedAt: Date;
	lines: Array<
		JournalLineRecord & {
			account: Pick<LedgerAccountRecord, "id" | "code" | "name" | "type"> | null;
		}
	>;
};

export type PayrollJournalPostingOptions = {
	disbursementAccounts: Array<{
		id: number;
		code: string | null;
		name: string;
	}>;
};

export type RecognitionJournalPostResult = {
	journalEntryId: number;
	breakdown: PayrollRecognitionTotals;
};

type SalaryDisbursementJournalResult = {
	journalEntryId: number;
	amountPosted: number;
};

type StatutoryRemittanceJournalResult = {
	journalEntryId: number;
	amountPosted: number;
	itemsPosted: PayrollRemittanceSummaryItem[];
	remittanceCompletionStatus: RemittanceCompletionStatus;
};

const PAYROLL_REMITTANCE_ROLE_BY_TYPE: Record<PayrollRemittanceItemType, PayrollAccountRole> = {
	paye: "paye_payable",
	nssf: "nssf_payable",
	shif: "shif_payable",
	ahl: "ahl_payable",
	nita: "nita_payable",
	helb: "helb_payable",
};

function getConnection(tx?: Transaction) {
	return tx ?? db;
}

function toPostedDate(entry: JournalEntryRecord) {
	return entry.entryDate;
}

function toJournalSummary(entry: JournalEntryWithLines): PayrollJournalSummaryEntry {
	const totals = getJournalBalanceSummary(entry.lines);

	return {
		id: entry.id,
		postedAt: toPostedDate(entry),
		totalDebits: totals.totalDebits,
		totalCredits: totals.totalCredits,
	};
}

function aggregateRemittedItems(
	items: z.infer<typeof statutoryRemittanceJournalSchema>["remittedItems"]
) {
	const amountsByType = Object.fromEntries(
		PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => [type, 0])
	) as Record<PayrollRemittanceItemType, number>;
	const referencesByType = Object.fromEntries(
		PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => [type, undefined as string | undefined])
	) as Record<PayrollRemittanceItemType, string | undefined>;

	for (const item of items) {
		amountsByType[item.type] = roundPayrollAmount(amountsByType[item.type] + item.amountRemitted);
		if (!referencesByType[item.type] && item.reference) {
			referencesByType[item.type] = item.reference;
		}
	}

	return PAYROLL_REMITTANCE_ITEM_TYPES.flatMap((type) => {
		const amountRemitted = amountsByType[type];

		if (amountRemitted <= 0) {
			return [];
		}

		return [{ type, amountRemitted, reference: referencesByType[type] }];
	});
}

async function requirePayrollPeriodsViewAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:view");
}

async function requirePayrollPeriodsTransitionAccess() {
	await requirePermission("employees:payroll-information");
	await requirePermission("payroll-periods:transition");
}

async function getPayrollPeriodRecordById(periodId: string, tx?: Transaction) {
	return getConnection(tx).query.payrollPeriods.findFirst({
		where: eq(payrollPeriods.id, periodId),
	});
}

async function validatePostingAssetAccount(
	accountId: number,
	label: string,
	tx?: Transaction
): Promise<
	Result<{
		id: number;
		code: string | null;
		name: string;
		type: AccountType;
	}>
> {
	const account = await getConnection(tx).query.ledgerAccounts.findFirst({
		columns: {
			id: true,
			code: true,
			name: true,
			type: true,
			isActive: true,
			isPosting: true,
		},
		where: eq(ledgerAccounts.id, accountId),
	});

	if (!account || !account.isActive) {
		return failure({
			type: "ValidationError",
			message: `The selected ${label} account does not exist or is inactive.`,
		});
	}

	if (!account.isPosting) {
		return failure({
			type: "ValidationError",
			message: `The selected ${label} account must be a posting account.`,
		});
	}

	if (account.type !== "asset") {
		return failure({
			type: "ValidationError",
			message: `The selected ${label} account must be an asset account.`,
		});
	}

	return success({
		id: account.id,
		code: account.code,
		name: account.name,
		type: account.type,
	});
}

async function getRequiredRemittanceAmounts(period: PayrollPeriodRecord, tx?: Transaction) {
	const totalHelb = await getProcessedHelbTotal(period.id, tx);

	return {
		paye: toNumber(period.totalPaye),
		nssf: roundPayrollAmount(
			toNumber(period.totalNssfEmployee) + toNumber(period.totalNssfEmployer)
		),
		shif: roundPayrollAmount(
			toNumber(period.totalShifEmployee) + toNumber(period.totalShifEmployer)
		),
		ahl: roundPayrollAmount(toNumber(period.totalAhlEmployee) + toNumber(period.totalAhlEmployer)),
		nita: toNumber(period.totalNita),
		helb: totalHelb,
	} satisfies Record<PayrollRemittanceItemType, number>;
}

async function getProcessedHelbTotal(periodId: string, tx?: Transaction) {
	const rows = await getConnection(tx).query.payrollSlips.findMany({
		columns: {
			helbDeduction: true,
		},
		where: and(eq(payrollSlips.payrollPeriodId, periodId), ne(payrollSlips.status, "cancelled")),
	});

	return roundPayrollAmount(rows.reduce((total, row) => total + toNumber(row.helbDeduction), 0));
}

async function listPayrollRemittanceEntries(periodId: string, tx?: Transaction) {
	return getConnection(tx).query.journalEntries.findMany({
		where: and(
			eq(journalEntries.source, PAYROLL_JOURNAL_SOURCES.PAYROLL_REMITTANCE),
			eq(journalEntries.sourceId, periodId)
		),
		orderBy: [asc(journalEntries.entryDate), asc(journalEntries.id)],
		with: {
			lines: {
				orderBy: asc(journalLines.lineNumber),
				with: {
					account: {
						columns: {
							id: true,
							code: true,
							name: true,
							type: true,
						},
					},
				},
			},
		},
	});
}

async function getRemittanceCompletionStatus(
	payrollPeriodId: string,
	tx?: Transaction
): Promise<Result<RemittanceCompletionStatus>> {
	const period = await getPayrollPeriodRecordById(payrollPeriodId, tx);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	const accountMappingsResult = await getAccountMappingsAsMapFn();

	if (!accountMappingsResult.success) {
		return failure({
			type: "ValidationError",
			message: accountMappingsResult.error.message,
		});
	}

	const accountIdToType = new Map(
		PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => [
			accountMappingsResult.data[PAYROLL_REMITTANCE_ROLE_BY_TYPE[type]],
			type,
		])
	);

	const requiredAmounts = await getRequiredRemittanceAmounts(period, tx);
	const remittanceEntries = await listPayrollRemittanceEntries(payrollPeriodId, tx);
	const remittedAmounts = Object.fromEntries(
		PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => [type, 0])
	) as Record<PayrollRemittanceItemType, number>;

	for (const entry of remittanceEntries) {
		for (const line of entry.lines) {
			if (line.dc !== "debit") {
				continue;
			}

			const type = accountIdToType.get(line.accountId);

			if (!type) {
				continue;
			}

			remittedAmounts[type] = roundPayrollAmount(remittedAmounts[type] + toNumber(line.amount));
		}
	}

	return success(buildRemittanceCompletionStatus(requiredAmounts, remittedAmounts));

	// const requiredAmounts = await getRequiredRemittanceAmounts(period, tx);
	// const remittanceEntries = await listPayrollRemittanceEntries(payrollPeriodId, tx);
	// const remittedAmounts = Object.fromEntries(
	// 	PAYROLL_REMITTANCE_ITEM_TYPES.map((type) => [type, 0])
	// ) as Record<PayrollRemittanceItemType, number>;

	// for (const entry of remittanceEntries) {
	// 	for (const line of entry.lines) {
	// 		if (line.dc !== "debit") {
	// 			continue;
	// 		}

	// 		const type = parseRemittanceLineMemoType(line.memo);

	// 		if (!type) {
	// 			continue;
	// 		}

	// 		remittedAmounts[type] = roundPayrollAmount(remittedAmounts[type] + toNumber(line.amount));
	// 	}
	// }

	// return success(buildRemittanceCompletionStatus(requiredAmounts, remittedAmounts));
}

async function getJournalEntryWithLines(
	journalEntryId: number
): Promise<Result<JournalEntryWithLines>> {
	const journalEntry = await db.query.journalEntries.findFirst({
		where: eq(journalEntries.id, journalEntryId),
		with: {
			lines: {
				orderBy: asc(journalLines.lineNumber),
				with: {
					account: {
						columns: {
							id: true,
							code: true,
							name: true,
							type: true,
						},
					},
				},
			},
		},
	});

	if (!journalEntry) {
		return failure({
			type: "NotFoundError",
			message: "Journal entry not found.",
		});
	}

	return success(journalEntry);
}

async function postSalaryDisbursementJournal(
	payload: z.infer<typeof salaryDisbursementJournalSchema>
): Promise<Result<SalaryDisbursementJournalResult>> {
	const period = await getPayrollPeriodRecordById(payload.periodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	if (period.status !== PAYROLL_PERIOD_STATUS.APPROVED) {
		return failure({
			type: "ValidationError",
			message: `Salary disbursement can only be recorded for approved periods. Current status: ${period.status}.`,
		});
	}

	if (period.payrollJournalEntryId === null) {
		return failure({
			type: "ValidationError",
			message: "Payroll recognition journal must be posted before disbursement can be recorded.",
		});
	}

	const accountValidation = await validatePostingAssetAccount(
		payload.disbursementAccountId,
		"disbursement"
	);

	if (!accountValidation.success) {
		return accountValidation;
	}

	const totalNetPay = toNumber(period.totalNetPay);

	if (totalNetPay <= 0) {
		return failure({
			type: "ValidationError",
			message: "Salary disbursement cannot be recorded because the period net pay is zero.",
		});
	}

	const accountMappingsResult = await getAccountMappingsAsMapFn();

	if (!accountMappingsResult.success) {
		return failure({
			type: "ValidationError",
			message: accountMappingsResult.error.message,
		});
	}

	try {
		const result = await db.transaction(async (tx) => {
			const [currentPeriod] = await tx
				.select({ disbursementJournalEntryId: payrollPeriods.disbursementJournalEntryId })
				.from(payrollPeriods)
				.where(eq(payrollPeriods.id, period.id))
				.for("update");

			if (currentPeriod?.disbursementJournalEntryId !== null) {
				return failure({
					type: "ValidationError",
					message: "Disbursement has already been recorded for this period.",
				});
			}

			const journalLinesToInsert = [
				{
					accountId: accountMappingsResult.data.net_salaries_payable,
					amount: toPayrollDecimalString(totalNetPay),
					dc: "debit" as const,
					lineNumber: 1,
					memo: `Payroll disbursement ${period.name}`,
				},
				{
					accountId: payload.disbursementAccountId,
					amount: toPayrollDecimalString(totalNetPay),
					dc: "credit" as const,
					lineNumber: 2,
					memo: `Payroll disbursement ${period.name}`,
				},
			];

			if (!areJournalValuesBalanced(journalLinesToInsert)) {
				return failure({
					type: "ApplicationError",
					message: "Salary disbursement journal is not balanced.",
				});
			}

			const journalEntryId = await createJournalEntry({
				entry: {
					// entryDate: payload.disbursementDate ?? todayIsoDate(),
					entryDate: period.payDate,
					reference: `PAYROLL-DISB-${period.name}`,
					description: `Salary disbursement - ${period.name}`,
					source: PAYROLL_JOURNAL_SOURCES.PAYROLL_DISBURSEMENT,
					sourceId: period.id,
				},
				lines: journalLinesToInsert,
				tx,
			});

			const updated = await tx
				.update(payrollPeriods)
				.set({
					disbursementJournalEntryId: journalEntryId,
					updatedAt: new Date(),
				})
				.where(
					and(eq(payrollPeriods.id, period.id), isNull(payrollPeriods.disbursementJournalEntryId))
				);

			if (updated.rowCount === 0) {
				return failure({
					type: "ValidationError",
					message: "Disbursement has already been recorded for this period.",
				});
			}

			return success({
				journalEntryId,
				amountPosted: totalNetPay,
			});
		});

		return result;
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to post salary disbursement journal.",
		});
	}
}

async function postStatutoryRemittanceJournal(
	payload: z.infer<typeof statutoryRemittanceJournalSchema>
): Promise<Result<StatutoryRemittanceJournalResult>> {
	const period = await getPayrollPeriodRecordById(payload.periodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	if (payload.remittanceDate && new Date(payload.remittanceDate) < new Date(period.payDate)) {
		return failure({
			type: "ValidationError",
			message: "Remittance date must be on or after the period's pay date.",
		});
	}

	if (period.status !== PAYROLL_PERIOD_STATUS.PAID) {
		return failure({
			type: "ValidationError",
			message: `Statutory remittance can only be recorded for paid periods. Current status: ${period.status}.`,
		});
	}

	const accountValidation = await validatePostingAssetAccount(
		payload.remittanceAccountId,
		"remittance"
	);

	if (!accountValidation.success) {
		return accountValidation;
	}

	const accountMappingsResult = await getAccountMappingsAsMapFn();

	if (!accountMappingsResult.success) {
		return failure({
			type: "ValidationError",
			message: accountMappingsResult.error.message,
		});
	}

	const remittedItems = aggregateRemittedItems(payload.remittedItems);

	try {
		const result = await db.transaction(async (tx) => {
			const completionStatusResult = await getRemittanceCompletionStatus(period.id, tx);

			if (!completionStatusResult.success) {
				return completionStatusResult;
			}

			const completionByType = new Map(
				completionStatusResult.data.items.map((item) => [item.type, item])
			);

			for (const item of remittedItems) {
				const currentStatus = completionByType.get(item.type);

				if (!currentStatus) {
					return failure({
						type: "ValidationError",
						message: `Unsupported remittance type: ${item.type}.`,
					});
				}

				if (item.amountRemitted <= 0) {
					return failure({
						type: "ValidationError",
						message: `${item.type.toUpperCase()} remittance amount must be greater than zero.`,
					});
				}

				if (item.amountRemitted > currentStatus.outstandingAmount) {
					return failure({
						type: "ValidationError",
						message: `${item.type.toUpperCase()} remittance of ${item.amountRemitted.toFixed(
							2
						)} exceeds the outstanding amount of ${currentStatus.outstandingAmount.toFixed(2)}.`,
					});
				}
			}

			const existingRemittanceEntries = await listPayrollRemittanceEntries(period.id, tx);
			const sequence = existingRemittanceEntries.length + 1;
			const totalAmount = roundPayrollAmount(
				remittedItems.reduce((total, item) => total + item.amountRemitted, 0)
			);
			const journalLinesToInsert = [
				...remittedItems.map((item, index) => ({
					accountId: accountMappingsResult.data[PAYROLL_REMITTANCE_ROLE_BY_TYPE[item.type]],
					amount: toPayrollDecimalString(item.amountRemitted),
					dc: "debit" as const,
					lineNumber: index + 1,
					memo: buildRemittanceLineMemo(item.type, period.name, item.reference),
				})),
				{
					accountId: payload.remittanceAccountId,
					amount: toPayrollDecimalString(totalAmount),
					dc: "credit" as const,
					lineNumber: remittedItems.length + 1,
					memo: `Payroll remittance ${period.name}`,
				},
			];

			if (!areJournalValuesBalanced(journalLinesToInsert)) {
				return failure({
					type: "ApplicationError",
					message: "Statutory remittance journal is not balanced.",
				});
			}

			const journalEntryId = await createJournalEntry({
				entry: {
					entryDate: payload.remittanceDate ?? todayIsoDate(),
					reference: `PAYROLL-REMIT-${period.name}-${sequence}`,
					description: `Statutory remittance - ${period.name} - ${remittedItems
						.map((item) => item.type.toUpperCase())
						.join(", ")}`,
					source: PAYROLL_JOURNAL_SOURCES.PAYROLL_REMITTANCE,
					sourceId: period.id,
				},
				lines: journalLinesToInsert,
				tx,
			});

			const updatedCompletionStatus = await getRemittanceCompletionStatus(period.id, tx);

			if (!updatedCompletionStatus.success) {
				return updatedCompletionStatus;
			}

			if (updatedCompletionStatus.data.isFullyRemitted) {
				await tx
					.update(payrollPeriods)
					.set({
						remittanceJournalEntryId: journalEntryId,
						updatedAt: new Date(),
					})
					.where(eq(payrollPeriods.id, period.id));
			}

			return success({
				journalEntryId,
				amountPosted: totalAmount,
				itemsPosted: remittedItems,
				remittanceCompletionStatus: updatedCompletionStatus.data,
			});
		});

		return result;
	} catch (error) {
		console.error(error);
		return failure({
			type: "ApplicationError",
			message: "Failed to post statutory remittance journal.",
		});
	}
}

async function getPayrollJournalPostingOptions(): Promise<PayrollJournalPostingOptions> {
	const disbursementAccounts = await db.query.ledgerAccounts.findMany({
		columns: {
			id: true,
			code: true,
			name: true,
		},
		where: and(
			eq(ledgerAccounts.type, "asset"),
			eq(ledgerAccounts.isActive, true),
			eq(ledgerAccounts.isPosting, true)
		),
		orderBy: [asc(ledgerAccounts.code), asc(ledgerAccounts.name)],
	});

	return {
		disbursementAccounts,
	};
}

async function getPayrollJournalSummary(
	payrollPeriodId: string
): Promise<Result<PayrollJournalSummary>> {
	const period = await getPayrollPeriodRecordById(payrollPeriodId);

	if (!period) {
		return failure({
			type: "NotFoundError",
			message: "Payroll period not found.",
		});
	}

	const [recognitionJournal, disbursementJournal, remittanceEntries, remittanceCompletionStatus] =
		await Promise.all([
			period.payrollJournalEntryId !== null
				? getJournalEntryWithLines(period.payrollJournalEntryId)
				: Promise.resolve(success<JournalEntryWithLines | null>(null)),
			period.disbursementJournalEntryId !== null
				? getJournalEntryWithLines(period.disbursementJournalEntryId)
				: Promise.resolve(success<JournalEntryWithLines | null>(null)),
			listPayrollRemittanceEntries(period.id),
			getRemittanceCompletionStatus(period.id),
		]);

	if (!recognitionJournal.success) {
		return recognitionJournal;
	}

	if (!disbursementJournal.success) {
		return disbursementJournal;
	}

	if (!remittanceCompletionStatus.success) {
		return remittanceCompletionStatus;
	}

	const disbursementSummary =
		disbursementJournal.data === null
			? null
			: {
					id: disbursementJournal.data.id,
					postedAt: toPostedDate(disbursementJournal.data),
					amount: getJournalBalanceSummary(disbursementJournal.data.lines).totalDebits,
					disbursementAccount:
						disbursementJournal.data.lines.find((line) => line.dc === "credit")?.account ?? null,
				};

	return success({
		recognitionJournal:
			recognitionJournal.data === null ? null : toJournalSummary(recognitionJournal.data),
		disbursementJournal: disbursementSummary,
		remittanceJournals: remittanceEntries.map((entry) => {
			const itemsRemitted = entry.lines.flatMap((line) => {
				if (line.dc !== "debit") {
					return [];
				}

				const type = parseRemittanceLineMemoType(line.memo);

				if (!type) {
					return [];
				}

				return [
					{
						type,
						amountRemitted: toNumber(line.amount),
					},
				];
			});

			return {
				id: entry.id,
				postedAt: toPostedDate(entry),
				itemsRemitted,
				totalAmount: roundPayrollAmount(
					itemsRemitted.reduce((total, item) => total + item.amountRemitted, 0)
				),
			};
		}),
		remittanceCompletionStatus: remittanceCompletionStatus.data,
		allJournalsComplete:
			period.payrollJournalEntryId !== null &&
			period.disbursementJournalEntryId !== null &&
			period.remittanceJournalEntryId !== null,
	});
}

export const getPayrollJournalPostingOptionsFn = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		await requirePayrollPeriodsViewAccess();
		return getPayrollJournalPostingOptions();
	});

export const getPayrollJournalSummaryFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollJournalPeriodIdSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getPayrollJournalSummary(data.periodId);
	});

export const getJournalEntryWithLinesFn = createServerFn()
	.middleware([authMiddleware])
	.validator(payrollJournalEntryIdSchema)
	.handler(async ({ data }) => {
		await requirePayrollPeriodsViewAccess();
		return getJournalEntryWithLines(data.journalEntryId);
	});

export const postSalaryDisbursementJournalFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(salaryDisbursementJournalSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollPeriodsTransitionAccess();
		const result = await postSalaryDisbursementJournal(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "post payroll disbursement journal",
					description: `Recorded payroll disbursement for period ${data.periodId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});

export const postStatutoryRemittanceJournalFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(statutoryRemittanceJournalSchema)
	.handler(async ({ data, context }) => {
		await requirePayrollPeriodsTransitionAccess();
		const result = await postStatutoryRemittanceJournal(data);

		if (result.success) {
			await logActivity({
				data: {
					action: "post payroll remittance journal",
					description: `Recorded statutory remittance for period ${data.periodId}`,
					userId: context.user.id,
				},
			});
		}

		return result;
	});
