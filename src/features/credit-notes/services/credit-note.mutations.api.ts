import { createServerFn } from "@tanstack/react-start";
import { addMonths } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { activityLogs, creditNotes, memberMemberships } from "@/drizzle/schema";
import {
	checkCreditNoteEligibility,
	computeCreditVatSplit,
} from "@/features/credit-notes/lib/eligibility";
import { nextCreditNoteNo } from "@/features/credit-notes/lib/numbering";
import { issueCreditNoteSchema } from "@/features/credit-notes/services/schemas";
import type { ReceiptJournalLine } from "@/features/receipts/lib/journal";
import { dateFormat, toBig, toDecimalString } from "@/lib/helpers";
import { requirePermission } from "@/lib/permissions/permissions";
import { failure, success, type Result } from "@/lib/result";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import { disableMemberAccessIfNoValidMembership } from "@/services/member-access";

// Same rollback convention as voidPaymentFn/upgradePaymentFn: throw to force a
// rollback while carrying the original failure Result out through the outer catch.
class CreditNoteTransactionError extends Error {
	constructor(readonly result: Extract<Result<never>, { success: false }>) {
		super("credit note transaction rolled back");
	}
}

export const issueCreditNoteFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(issueCreditNoteSchema)
	.handler(
		async ({
			data: { membershipId, reason, amount: amountOverride },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("credit-notes:create");

			const fail = (error: Parameters<typeof failure>[0]) =>
				new CreditNoteTransactionError({ success: false, error });

			try {
				const result = await db.transaction(async (tx) => {
					const eligibility = await checkCreditNoteEligibility(tx, membershipId);
					if (!eligibility.success) {
						throw new CreditNoteTransactionError(eligibility);
					}
					const {
						membership,
						plan,
						payment,
						priceCharged,
						dailyRate,
						unusedDays,
						suggestedAmount,
						taxRatio,
					} = eligibility.data;

					// Staff can override the suggested amount, but never above what was
					// actually charged for this membership row.
					const requestedAmount =
						amountOverride !== undefined ? toBig(amountOverride) : toBig(suggestedAmount);
					const amountBig = requestedAmount.gt(priceCharged)
						? toBig(priceCharged)
						: requestedAmount;
					if (amountBig.lte(0)) {
						throw fail({
							type: "ApplicationError",
							message: "Credit amount must be greater than zero.",
						});
					}
					const amount = toDecimalString(amountBig);
					const { creditSubtotal, creditTax } = computeCreditVatSplit(amount, taxRatio);
					const hasTax = toBig(creditTax).gt(0);

					if (!plan.revenueAccountId) {
						throw fail({
							type: "ApplicationError",
							message: "Plan revenue account is not configured",
						});
					}
					const settings = await tx.query.settings.findFirst({ columns: { billing: true } });
					if (!settings?.billing?.memberCreditsPayableAccountId) {
						throw fail({
							type: "ApplicationError",
							message: "Member credits payable account is not configured",
						});
					}
					if (hasTax && !settings.billing.vatAccountId) {
						throw fail({ type: "ApplicationError", message: "VAT account is not configured" });
					}

					// Issuance journal is the inverse of a receipt's: revenue+VAT are
					// debited (reversing recognized revenue for the unused portion) and the
					// credits-payable liability is credited. buildReceiptJournalLines is
					// shaped for the opposite (credit revenue/VAT, debit bank), so this is
					// built directly rather than forcing it through that helper.
					const description = `Credit note issuance for membership ${membership.id} (receipt #${payment.paymentNo}). Reason: ${reason}`;
					const lines: ReceiptJournalLine[] = [
						{
							lineNumber: 1,
							accountId: plan.revenueAccountId,
							amount: creditSubtotal,
							dc: "debit",
							memo: description,
						},
						...(hasTax
							? [
									{
										lineNumber: 2,
										accountId: settings.billing.vatAccountId as number,
										amount: creditTax,
										dc: "debit" as const,
										memo: description,
									},
								]
							: []),
						{
							lineNumber: hasTax ? 3 : 2,
							accountId: settings.billing.memberCreditsPayableAccountId,
							amount,
							dc: "credit",
							memo: description,
						},
					];

					if (!areJournalValuesBalanced(lines)) {
						throw fail({
							type: "ApplicationError",
							message: "Journal values are not balanced",
						});
					}

					const today = dateFormat(new Date());

					await tx
						.update(memberMemberships)
						.set({ status: "terminated", terminatedAt: today, terminatedReason: reason })
						.where(eq(memberMemberships.id, membershipId));

					// This may have been the member's only remaining valid membership —
					// mirrors the same check the daily expiry cron runs, since a terminated
					// row (unlike an expired one) is otherwise invisible to that job.
					await disableMemberAccessIfNoValidMembership(
						tx,
						membership.memberId,
						"credit_note_termination"
					);

					const expiryMonths = settings.billing.creditNoteExpiryMonths ?? 12;
					const creditNoteNo = await nextCreditNoteNo(tx);
					const [creditNote] = await tx
						.insert(creditNotes)
						.values({
							creditNoteNo: creditNoteNo.toString(),
							memberId: membership.memberId,
							originalPaymentId: payment.id,
							originalMembershipId: membership.id,
							reason,
							unusedDays,
							dailyRate,
							suggestedAmount,
							creditSubtotal,
							creditTax,
							amount,
							balanceRemaining: amount,
							status: "active",
							expiresAt: dateFormat(addMonths(new Date(), expiryMonths)),
							issuedByUserId: userId,
						})
						.returning();

					await createJournalEntry({
						entry: {
							entryDate: today,
							reference: creditNote.creditNoteNo,
							source: "credit note issuance",
							sourceId: creditNote.id,
							description,
						},
						lines,
						tx,
					});

					await tx.insert(activityLogs).values({
						userId,
						action: "issue credit note",
						description: `Issued credit note ${creditNote.creditNoteNo} for KES ${amount} against membership ${membership.id} (receipt #${payment.paymentNo}). Reason: ${reason}`,
					});

					return success(creditNote);
				});

				return result;
			} catch (error) {
				if (error instanceof CreditNoteTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong. Please try again.",
				});
			}
		}
	);
