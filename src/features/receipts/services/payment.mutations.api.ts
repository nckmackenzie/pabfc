import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import {
	activityLogs,
	addonInvoiceLines,
	addonInvoices,
	addons,
	bankAccounts,
	bankPostings,
	creditNoteRedemptions,
	ledgerAccounts,
	memberMemberships,
	members,
	membershipPlans,
	membershipUpgrades,
	mpesaStkRequests,
	paymentMembers,
	payments,
	users,
} from "@/drizzle/schema";
import { nextAddonInvoiceNo } from "@/features/addons/services/addon-invoice.helpers";
import {
	buildAddonInvoiceLines,
	type ComputedAddonLine,
	type PriceableAddon,
	sumAddonSubtotal,
} from "@/features/addons/lib/helpers";
import {
	finalizeMembershipPayment,
	type Transaction,
} from "@/features/receipts/services/membership-payment-finalizer";
import { buildReceiptJournalLines } from "@/features/receipts/lib/journal";
import { checkUpgradeEligibility } from "@/features/receipts/lib/upgrade";
import {
	applyCreditRedemption,
	lockMemberCredits,
	restoreCreditNoteBalance,
} from "@/features/credit-notes/lib/redemption";
import { getAvailableCreditBalance } from "@/features/credit-notes/lib/fifo";
import { buildVoidReversalJournalLines, checkVoidEligibility } from "@/features/receipts/lib/void";
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import { createBankingEntry } from "@/services/banking";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import {
	addonOnlyPaymentSchema,
	paymentSchema,
	upgradePaymentSchema,
	voidPaymentSchema,
} from "@/features/receipts/services/schemas";
import {
	computeMembershipEndDate,
	isEligibleUpgradePlan,
	membershipRangeConflicts,
	splitAmountEvenly,
} from "@/features/receipts/lib/helpers";
import {
	discountCalculator,
	dateFormat,
	generateFullPaymentInvoiceNo,
	taxCalculator,
	toBig,
	toDecimalString,
} from "@/lib/helpers";
import { initiateMpesaStkPush, registerUrlCallacks } from "@/lib/mpesa";
import { userHasPermission } from "@/lib/permissions/permission-queries";
import { requirePermission } from "@/lib/permissions/permissions";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { failure, success, type Result } from "@/lib/result";

// Thrown inside a payment transaction to force a rollback while carrying the
// original failure Result untouched. Returning a failure from the transaction
// callback would let Drizzle commit the partial writes (payment + members) that
// happened before the failure; throwing rolls them back, and the outer catch
// re-surfaces the carried failure unchanged.
class PaymentTransactionError extends Error {
	constructor(readonly result: Extract<Result<never>, { success: false }>) {
		super("payment transaction rolled back");
	}
}

async function checkMembershipOverlap({
	tx,
	memberIds,
	startDate,
	endDate,
}: {
	tx: Transaction;
	memberIds: string[];
	startDate: string;
	endDate: string;
}): Promise<Result<void>> {
	for (const memberId of memberIds) {
		const existing = await tx.query.memberMemberships.findMany({
			where: eq(memberMemberships.memberId, memberId),
			columns: { id: true, status: true, startDate: true, endDate: true },
		});
		const conflict = existing.find((m) =>
			membershipRangeConflicts({
				status: m.status,
				existingStart: m.startDate,
				existingEnd: m.endDate,
				newStart: startDate,
				newEnd: endDate,
			})
		);
		if (conflict) {
			return failure({
				type: "ConflictError",
				message: `Selected dates overlap with an existing membership (${conflict.startDate} to ${conflict.endDate ?? "open-ended"}).`,
			});
		}
	}
	return success(undefined);
}

async function lockMemberMembershipCreation(tx: Transaction, memberId: string) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtext('member_memberships'), hashtext(${memberId}))`
	);
}

// Fetches the selected addons (deduped, order preserved), enforcing that every one
// exists, is active, and has a positive rate. Shared by the membership+addon and
// addon-only payment paths.
async function fetchActiveAddons(addonIds: string[]): Promise<Result<PriceableAddon[]>> {
	const uniqueIds = [...new Set(addonIds)];
	const rows = await db
		.select({
			id: addons.id,
			name: addons.name,
			amount: addons.amount,
			perMember: addons.perMember,
			revenueAccountId: addons.revenueAccountId,
		})
		.from(addons)
		.where(and(inArray(addons.id, uniqueIds), eq(addons.active, true)));

	if (rows.length !== uniqueIds.length) {
		return failure({
			type: "ApplicationError",
			message: "One or more selected addons are unavailable or inactive.",
		});
	}
	if (rows.some((addon) => toBig(addon.amount).lte(0))) {
		return failure({
			type: "ApplicationError",
			message: "Addon rate must be greater than zero.",
		});
	}

	const byId = new Map(rows.map((addon) => [addon.id, addon]));
	return success(uniqueIds.map((addonId) => byId.get(addonId) as PriceableAddon));
}

const stkPaymentSchema = paymentSchema.extend({
	phoneNumber: z
		.string()
		.min(1, { error: "Phone Number is required" })
		.regex(/254\d{9}/, { error: "Invalid phone number" }),
});

export const initiateStkPushFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(stkPaymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");

			const { phoneNumber, memberIds, planId, paymentDate, discountType, discount } = data;
			const paymentNo = await getPaymentNo();
			const settings = await db.query.settings.findFirst({
				columns: { billing: true },
			});

			const plan = await db.query.membershipPlans.findFirst({
				where: (plans, { eq }) => eq(plans.id, planId),
			});

			if (!plan) {
				throw new Error("Plan not found");
			}

			if (plan.memberCount > 1) {
				throw new Error("Group plans must be paid via manual receipt entry, not M-Pesa STK push.");
			}

			const memberId = memberIds[0];
			const discountedAmount = discountCalculator(discountType, discount ?? 0, plan.price);

			const amount = plan.price - discountedAmount;

			const accountReference = generateFullPaymentInvoiceNo(
				paymentNo,
				settings?.billing?.invoicePrefix,
				settings?.billing?.invoiceNumberPadding
			);

			const mpesaRes = await initiateMpesaStkPush({
				amount,
				phoneNumber,
				accountReference,
				transactionDesc: "Membership Plan Payment",
			});

			const checkoutRequestId = mpesaRes.CheckoutRequestID;
			const merchantRequestId = mpesaRes.MerchantRequestID;

			const taxType = settings?.billing?.applyTaxToMembership
				? (settings.billing?.vatType ?? "inclusive")
				: "none";
			const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(amount, taxType);

			const paymentId = await db.transaction(async (tx) => {
				await tx.insert(mpesaStkRequests).values({
					memberId,
					amount: amount.toString(),
					initiatedChannel: "staff",
					phoneNumber,
					checkoutRequestId,
					merchantRequestId,
					status: "pending",
				});

				const [{ id }] = await tx
					.insert(payments)
					.values({
						paymentDate: new Date(paymentDate),
						amount: plan.price.toString(),
						lineTotal: amountExlusiveTax.toString(),
						memberId,
						planId,
						paymentNo: paymentNo.toString(),
						status: "pending",
						discountType,
						discount: discount ? discount.toString() : null,
						discountedAmount: discountedAmount.toString(),
						method: "mpesa_stk",
						channel: "staff",
						taxAmount: taxAmount.toString(),
						totalAmount: totalInclusiveTax.toString(),
						externalReference: checkoutRequestId,
						createdByUserId: userId,
						vatType: taxType,
					})
					.returning({ id: payments.id });

				return id;
			});

			return {
				checkoutRequestId,
				merchantRequestId,
				customerMessage: mpesaRes.CustomerMessage,
				responseDescription: mpesaRes.ResponseDescription,
				paymentId,
			};
		}
	);

export const registerUrlCallacksFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async () => {
		await registerUrlCallacks();
		return { success: true };
	});

export const createManualMembershipPaymentFn = createServerFn({
	method: "POST",
})
	.middleware([authMiddleware])
	.validator(paymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");
			try {
				const {
					memberIds,
					planId,
					paymentDate,
					startDate,
					numberOfPeriods,
					discountType,
					discount,
					reference,
					appliedCreditAmount,
				} = data;

				const uniqueMemberIds = [...new Set(memberIds)];
				if (uniqueMemberIds.length !== memberIds.length) {
					return failure({
						type: "ApplicationError",
						message: "Duplicate members selected.",
					});
				}

				const paymentNo = await getPaymentNo();
				const settings = await db.query.settings.findFirst({
					columns: { billing: true },
				});
				const plan = await db.query.membershipPlans.findFirst({
					where: (plans, { eq }) => eq(plans.id, planId),
				});

				if (!plan) {
					return failure({ type: "NotFoundError", message: "Plan not found" });
				}

				if (memberIds.length !== plan.memberCount) {
					return failure({
						type: "ApplicationError",
						message: `This plan requires exactly ${plan.memberCount} member(s), but ${memberIds.length} were selected.`,
					});
				}

				const selectedMembers = await db.query.members.findMany({
					columns: { id: true, memberStatus: true },
					where: inArray(members.id, memberIds),
				});
				if (
					selectedMembers.length !== memberIds.length ||
					selectedMembers.some((member) => member.memberStatus !== "active")
				) {
					return failure({
						type: "ApplicationError",
						message: "All selected members must be active.",
					});
				}

				// The first selected member is treated as the billing member — the
				// account holder recorded on payments.memberId.
				const billingMemberId = memberIds[0];

				const baseAmount = plan.price * plan.memberCount * numberOfPeriods;
				const discountedAmount = discountCalculator(discountType, discount ?? 0, baseAmount);
				const amount = Math.max(0, baseAmount - discountedAmount);

				if (amount <= 0) {
					return failure({
						type: "ApplicationError",
						message: "Payment amount must be greater than zero",
					});
				}

				const taxType = settings?.billing?.applyTaxToMembership
					? (settings.billing?.vatType ?? "inclusive")
					: "none";
				const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(amount, taxType);

				// Addons (optional): VAT-exempt and undiscounted, so they are priced
				// independently and added on top of the membership total. perMember addons
				// multiply by the plan's member count.
				let addonLines: ComputedAddonLine[] = [];
				let addonSubtotal = "0.00";
				if (data.addonIds && data.addonIds.length > 0) {
					const addonResult = await fetchActiveAddons(data.addonIds);
					if (!addonResult.success) {
						return addonResult;
					}
					addonLines = buildAddonInvoiceLines(addonResult.data, {
						numberOfPeriods,
						numberOfMembers: plan.memberCount,
					});
					addonSubtotal = sumAddonSubtotal(addonLines);
				}

				// Bank receives the full amount — membership total (incl. its VAT) plus the
				// untaxed addon subtotal.
				const combinedTotal = toDecimalString(toBig(totalInclusiveTax).plus(toBig(addonSubtotal)));

				const result = await db.transaction(async (tx) => {
					// Acquire per-member advisory locks in a stable (sorted) order so that
					// two concurrent group payments sharing a member can't deadlock each
					// other by locking the same members in opposite orders.
					const sortedMemberIds = [...memberIds].sort();
					for (const memberId of sortedMemberIds) {
						await lockMemberMembershipCreation(tx, memberId);
					}

					const candidateEndDate = dateFormat(
						computeMembershipEndDate(startDate, plan.duration, numberOfPeriods)
					);
					const overlapCheck = await checkMembershipOverlap({
						tx,
						memberIds,
						startDate,
						endDate: candidateEndDate,
					});
					if (!overlapCheck.success) {
						throw new PaymentTransactionError(overlapCheck);
					}

					const [payment] = await tx
						.insert(payments)
						.values({
							paymentDate: new Date(paymentDate),
							amount: baseAmount.toString(),
							numberOfPeriods,
							lineTotal: amountExlusiveTax.toString(),
							memberId: billingMemberId,
							planId,
							paymentNo: paymentNo.toString(),
							status: "completed",
							discountType,
							discount: discount ? discount.toString() : null,
							discountedAmount: discountedAmount.toString(),
							method: "mpesa_manual",
							channel: "staff",
							taxAmount: taxAmount.toString(),
							totalAmount: combinedTotal,
							reference,
							createdByUserId: userId,
							vatType: taxType,
						})
						.returning();

					await tx.insert(paymentMembers).values(
						memberIds.map((memberId) => ({
							paymentId: payment.id,
							memberId,
						}))
					);

					const finalizeResult = await finalizeMembershipPayment({
						tx,
						payment,
						memberIds,
						reference,
						updatePendingPayment: false,
						startDate,
						numberOfPeriods,
						addonLines: addonLines.length > 0 ? addonLines : undefined,
						appliedCreditAmount:
							appliedCreditAmount && appliedCreditAmount > 0
								? toDecimalString(appliedCreditAmount)
								: undefined,
						activityLog: {
							action: "create receipt",
							description: `Created membership receipt ${paymentNo}.`,
							userId,
						},
					});

					// Roll the whole transaction back on failure so the payment/members
					// rows inserted above aren't committed without their memberships and
					// journal entry.
					if (!finalizeResult.success) {
						throw new PaymentTransactionError(finalizeResult);
					}

					return finalizeResult;
				});

				// The transaction only ever resolves with a success result — every
				// failure path throws PaymentTransactionError, handled below.
				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

export const voidPaymentFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(voidPaymentSchema)
	.handler(
		async ({
			data: { paymentId, voidReason },
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:void");

			try {
				const result = await db.transaction(async (tx) => {
					// Lock on the covered members before the eligibility check — the same
					// resource upgradePaymentFn locks — so a concurrent void/upgrade on this
					// payment can't both pass eligibility and race to conflicting writes
					// (e.g. void deletes the membership while an upgrade extends it).
					const coveredMemberRows = await tx.query.paymentMembers.findMany({
						where: eq(paymentMembers.paymentId, paymentId),
						columns: { memberId: true },
					});
					const sortedMemberIds = [...new Set(coveredMemberRows.map((row) => row.memberId))].sort();
					for (const memberId of sortedMemberIds) {
						await lockMemberMembershipCreation(tx, memberId);
					}

					const eligibility = await checkVoidEligibility(tx, paymentId);
					if (!eligibility.success) {
						throw new PaymentTransactionError(eligibility);
					}
					const { payment, coveredMembers } = eligibility.data;

					const reversalLinesResult = await buildVoidReversalJournalLines(tx, payment);
					if (!reversalLinesResult.success) {
						throw new PaymentTransactionError(reversalLinesResult);
					}
					const reversalLines = reversalLinesResult.data;

					const voidingUser = await tx.query.users.findFirst({
						where: eq(users.id, userId),
						columns: { name: true },
					});

					// Member names must be captured above before this delete — the join
					// table won't be queryable for them afterward.
					await tx.delete(memberMemberships).where(eq(memberMemberships.paymentId, payment.id));
					await tx.delete(paymentMembers).where(eq(paymentMembers.paymentId, payment.id));

					const now = new Date();
					await tx
						.update(payments)
						.set({ status: "voided", voidedAt: now, voidedByUserId: userId, voidReason })
						.where(and(eq(payments.id, payment.id), eq(payments.status, "completed")));

					await tx
						.update(addonInvoices)
						.set({ status: "voided", voidedAt: now, voidedByUserId: userId, voidReason })
						.where(eq(addonInvoices.paymentId, payment.id));

					const memberNames = coveredMembers.map((member) => member.name).join(", ");
					const description = `VOID REVERSAL — Original receipt #${payment.paymentNo} voided on ${dateFormat(now, "long")} by ${voidingUser?.name ?? "Unknown user"}. Reason: ${voidReason}`;

					await createJournalEntry({
						entry: {
							entryDate: dateFormat(now),
							reference: payment.paymentNo,
							source: "payment void",
							sourceId: payment.id,
							description,
						},
						lines: reversalLines,
						tx,
					});

					// If the original payment posted a banking entry, mirror it back with
					// dc flipped — same "mirror the actual entry" principle as the journal.
					const originalBankPosting = await tx.query.bankPostings.findFirst({
						where: and(
							eq(bankPostings.source, "plan payment"),
							eq(bankPostings.sourceId, payment.id)
						),
					});
					if (originalBankPosting) {
						await createBankingEntry({
							tx,
							entry: {
								bankId: originalBankPosting.bankId,
								dc: originalBankPosting.dc === "debit" ? "credit" : "debit",
								amount: originalBankPosting.amount,
								reference: originalBankPosting.reference,
								transactionDate: dateFormat(now),
								source: "payment void",
								sourceId: payment.id,
								narration: description,
							},
						});
					}

					// The reversal journal above already mirrors the original entry's lines
					// (including any CR memberCreditsPayable line), but that only fixes the
					// GL — the subsidiary ledger (each credit note's own balance) doesn't
					// self-correct and must be restored explicitly.
					const redeemedCreditNotes = await tx.query.creditNoteRedemptions.findMany({
						where: eq(creditNoteRedemptions.paymentId, payment.id),
						with: { creditNote: { columns: { memberId: true } } },
					});
					// Same lock namespace applyCreditRedemption/expireCreditNotes use —
					// without it, a concurrent redemption reading+decrementing the same
					// credit note's balance could be overwritten by this restore (or vice
					// versa) since restoreCreditNoteBalance's read-then-update isn't
					// otherwise serialized against them.
					const redeemedMemberIds = [
						...new Set(redeemedCreditNotes.map((redemption) => redemption.creditNote.memberId)),
					].sort();
					for (const memberId of redeemedMemberIds) {
						await lockMemberCredits(tx, memberId);
					}
					for (const redemption of redeemedCreditNotes) {
						await tx
							.delete(creditNoteRedemptions)
							.where(eq(creditNoteRedemptions.id, redemption.id));
						await restoreCreditNoteBalance(tx, redemption.creditNoteId, redemption.amountApplied);
					}

					await tx.insert(activityLogs).values({
						userId,
						action: "void receipt",
						description: `Voided receipt ${payment.paymentNo}. Reason: ${voidReason}. Affected member(s): ${memberNames}.`,
					});

					return success(undefined);
				});

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

// Converts a member from a cheaper/shorter plan onto a pricier one, retroactively
// from their original start date, for a staff-entered top-up amount. Does not call
// finalizeMembershipPayment and does not insert a new memberMemberships row — it
// mutates the existing row(s) in place, which is why voidPaymentFn (via
// checkVoidEligibility) refuses to void either side of an upgrade.
export const upgradePaymentFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(upgradePaymentSchema)
	.handler(
		async ({
			data: {
				originalPaymentId,
				newPlanId,
				topUpAmount,
				reference,
				upgradeDate,
				notes,
				lateUpgradeReason,
			},
			context: {
				user: { id: userId, role },
			},
		}) => {
			await requirePermission("receipts:top-up");

			// Small helper so ad hoc validation failures inside the transaction can throw
			// a properly-typed PaymentTransactionError without an intermediate `Result`
			// variable — mirrors the `if (!result.success) throw ...` idiom used for the
			// eligibility/overlap checks below, just for checks that aren't already
			// wrapped in a Result-returning helper.
			const fail = (error: Parameters<typeof failure>[0]) =>
				new PaymentTransactionError({ success: false, error });

			try {
				const result = await db.transaction(async (tx) => {
					// Lock on the covered members (sorted, same convention as
					// createManualMembershipPaymentFn) before the authoritative eligibility
					// check, so a concurrent void/upgrade/renewal on the same members can't
					// slip in between the check and this transaction's writes.
					const coveredMemberRows = await tx.query.paymentMembers.findMany({
						where: eq(paymentMembers.paymentId, originalPaymentId),
						columns: { memberId: true },
					});
					const sortedMemberIds = [...new Set(coveredMemberRows.map((row) => row.memberId))].sort();
					for (const memberId of sortedMemberIds) {
						await lockMemberMembershipCreation(tx, memberId);
					}

					const hasLateUpgradePermission = await userHasPermission(
						userId,
						role,
						"receipts:top-up-late"
					);
					const eligibility = await checkUpgradeEligibility(
						tx,
						originalPaymentId,
						hasLateUpgradePermission
					);
					if (!eligibility.success) {
						throw new PaymentTransactionError(eligibility);
					}
					const {
						payment: originalPayment,
						plan: originalPlan,
						memberships,
						coveredMembers,
						billingMemberId,
						originalStartDate,
						originalNumberOfPeriods,
						isLate,
						daysLate,
					} = eligibility.data;

					// The eligibility check already confirmed grace-period + permission when
					// isLate is true; this only enforces that a reason was actually supplied,
					// same minimum-length convention as voidPaymentSchema's voidReason.
					if (isLate) {
						const trimmedReason = lateUpgradeReason?.trim() ?? "";
						if (trimmedReason.length < 10) {
							throw fail({
								type: "ApplicationError",
								message: "A reason (at least 10 characters) is required for a late upgrade.",
							});
						}
					}

					const newPlan = await tx.query.membershipPlans.findFirst({
						where: eq(membershipPlans.id, newPlanId),
					});
					if (!newPlan) {
						throw fail({ type: "NotFoundError", message: "New plan not found" });
					}
					if (!newPlan.active) {
						throw fail({ type: "ApplicationError", message: "The selected plan is not active." });
					}
					if (!newPlan.revenueAccountId) {
						throw fail({
							type: "ApplicationError",
							message: "Plan revenue account is not configured",
						});
					}
					// Mirrors the client-side select filtering (isEligibleUpgradePlan) so a
					// stale/tampered client can't downgrade a member's duration or move the
					// covered members onto a plan requiring a different headcount — this flow
					// can't add or remove members, so the counts must match exactly.
					if (newPlan.memberCount !== originalPlan.memberCount) {
						throw fail({
							type: "ApplicationError",
							message: `Cannot upgrade to ${newPlan.name}: it requires ${newPlan.memberCount} member(s), but this receipt covers ${originalPlan.memberCount}.`,
						});
					}
					if (!isEligibleUpgradePlan(newPlan, originalPlan)) {
						throw fail({
							type: "ApplicationError",
							message: `Cannot upgrade to ${newPlan.name}: its duration (${newPlan.duration} days) is shorter than the current plan's (${originalPlan.duration} days).`,
						});
					}

					const settings = await tx.query.settings.findFirst({
						columns: { billing: true },
					});

					const newEndDate = computeMembershipEndDate(
						originalStartDate,
						newPlan.duration,
						originalNumberOfPeriods
					);

					const paymentNo = await getPaymentNo();

					// Same VAT treatment as normal membership payments (not the VAT-exempt
					// addon treatment) — see membership-payment-finalizer.ts's tax block.
					const taxType = settings?.billing?.applyTaxToMembership
						? (settings.billing?.vatType ?? "inclusive")
						: "none";
					const { amountExlusiveTax, taxAmount, totalInclusiveTax } = taxCalculator(
						topUpAmount,
						taxType
					);
					const hasTax = taxAmount > 0;
					if (hasTax && !settings?.billing?.vatAccountId) {
						throw fail({ type: "ApplicationError", message: "VAT account is not configured" });
					}

					let hasSettlementAccount = false;
					let bankAccount: number;
					if (settings?.billing?.mpesaSettlementAccountId) {
						hasSettlementAccount = true;
						bankAccount = settings.billing.mpesaSettlementAccountId;
					} else {
						const fetchedAccount = await tx.query.ledgerAccounts.findFirst({
							columns: { id: true },
							where: eq(sql`lower(${ledgerAccounts.name})`, "cash at bank"),
						});
						if (!fetchedAccount) {
							throw fail({
								type: "ApplicationError",
								message: "No bank account configured for payments",
							});
						}
						bankAccount = fetchedAccount.id;
					}

					const description = `Top-up upgrade for receipt # ${originalPayment.paymentNo} — ${originalPlan.name} to ${newPlan.name} - ${reference}`;

					const lines = buildReceiptJournalLines({
						membershipRevenue: {
							accountId: newPlan.revenueAccountId,
							amount: toDecimalString(amountExlusiveTax),
						},
						vat:
							hasTax && settings?.billing?.vatAccountId
								? { accountId: settings.billing.vatAccountId, amount: toDecimalString(taxAmount) }
								: null,
						bankAccountId: bankAccount,
						bankAmount: toDecimalString(totalInclusiveTax),
						memo: description,
					});

					if (!areJournalValuesBalanced(lines)) {
						throw fail({ type: "ApplicationError", message: "Journal values are not balanced" });
					}

					const [newPayment] = await tx
						.insert(payments)
						.values({
							paymentDate: new Date(upgradeDate),
							amount: toDecimalString(topUpAmount),
							numberOfPeriods: originalNumberOfPeriods,
							lineTotal: toDecimalString(amountExlusiveTax),
							memberId: billingMemberId,
							planId: newPlanId,
							paymentNo: paymentNo.toString(),
							status: "completed",
							discountType: "none",
							discountedAmount: "0",
							taxAmount: toDecimalString(taxAmount),
							totalAmount: toDecimalString(totalInclusiveTax),
							reference,
							// Matches createManualMembershipPaymentFn's convention — this flow
							// has no method/channel form fields, so it's hardcoded the same way.
							method: "mpesa_manual",
							channel: "staff",
							createdByUserId: userId,
							vatType: taxType,
						})
						.returning();

					await tx.insert(paymentMembers).values(
						coveredMembers.map(({ id: memberId }) => ({
							paymentId: newPayment.id,
							memberId,
						}))
					);

					// Split the top-up across each covered member's existing priceCharged —
					// same billing-member-gets-the-leftover-cent convention finalizeMembership
					// Payment uses for the initial split — so the new plan's member list
					// reflects the full amount charged for this period, not just the
					// pre-upgrade price.
					const orderedMemberIds = [
						billingMemberId,
						...coveredMembers.map(({ id }) => id).filter((id) => id !== billingMemberId),
					];
					const topUpShares = splitAmountEvenly(
						toDecimalString(topUpAmount),
						orderedMemberIds.length
					);
					const topUpShareByMemberId = new Map(
						orderedMemberIds.map((id, index) => [id, topUpShares[index]])
					);

					// The mutated rows deliberately keep pointing at `originalPaymentId` —
					// this is the same membership period, just extended. That's why Void's
					// eligibility check (checkVoidEligibility) separately guards against
					// voiding either side of an upgrade.
					for (const membership of memberships) {
						const share = topUpShareByMemberId.get(membership.memberId) ?? "0.00";
						await tx
							.update(memberMemberships)
							.set({
								membershipPlanId: newPlanId,
								endDate: dateFormat(newEndDate),
								priceCharged: toDecimalString(toBig(membership.priceCharged).plus(toBig(share))),
							})
							.where(eq(memberMemberships.id, membership.id));
					}

					await createJournalEntry({
						entry: {
							entryDate: dateFormat(upgradeDate),
							reference: newPayment.paymentNo,
							source: "membership upgrade",
							sourceId: newPayment.id,
							description,
						},
						lines,
						tx,
					});

					if (hasSettlementAccount) {
						const bankAccountRow = await tx.query.bankAccounts.findFirst({
							columns: { id: true },
							where: eq(bankAccounts.accountId, bankAccount),
						});
						if (bankAccountRow?.id) {
							await createBankingEntry({
								tx,
								entry: {
									bankId: bankAccountRow.id,
									dc: "debit",
									amount: toDecimalString(totalInclusiveTax),
									reference: reference ?? newPayment.paymentNo,
									transactionDate: dateFormat(upgradeDate),
									source: "membership upgrade",
									sourceId: newPayment.id,
									narration: description,
								},
							});
						}
					}

					const trimmedLateReason = lateUpgradeReason?.trim() || null;

					await tx.insert(membershipUpgrades).values({
						originalPaymentId,
						upgradePaymentId: newPayment.id,
						memberId: billingMemberId,
						originalPlanId: originalPlan.id,
						newPlanId,
						originalEndDate: memberships[0]?.endDate ?? null,
						newEndDate: dateFormat(newEndDate),
						topUpAmount: toDecimalString(topUpAmount),
						upgradeDate,
						notes: notes ?? null,
						createdByUserId: userId,
						isLateUpgrade: isLate,
						daysAfterExpiry: isLate ? daysLate : null,
						lateUpgradeReason: isLate ? trimmedLateReason : null,
					});

					// Informational only — the recomputed end date can still land before
					// today for a sufficiently overdue late upgrade. The upgrade itself is
					// never blocked on this; the caller just needs to see it clearly.
					const lateSuffix = isLate
						? ` LATE UPGRADE (${daysLate} day(s) after expiry). Reason: ${trimmedLateReason}.`
						: "";
					await tx.insert(activityLogs).values({
						userId,
						action: "upgrade membership",
						description: `Upgraded receipt ${originalPayment.paymentNo} from ${originalPlan.name} to ${newPlan.name} via top-up receipt ${paymentNo}. Affected member(s): ${coveredMembers.map((member) => member.name).join(", ")}.${lateSuffix}`,
					});

					const warning =
						dateFormat(newEndDate) < dateFormat(new Date())
							? `The recomputed membership end date (${dateFormat(newEndDate)}) is still before today — the member may need a new payment to regain access.`
							: null;

					return success({ id: newPayment.id, warning });
				});

				return result;
			} catch (error) {
				if (error instanceof PaymentTransactionError) {
					return error.result;
				}
				console.log(error);
				return failure({
					type: "ApplicationError",
					message: "Something went wrong.Please try again.",
				});
			}
		}
	);

export const createAddonOnlyPaymentFn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(addonOnlyPaymentSchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			await requirePermission("receipts:create");

			const { memberIds, addonIds, paymentDate, numberOfPeriods, reference, appliedCreditAmount } =
				data;

			const uniqueMemberIds = [...new Set(memberIds)];
			if (uniqueMemberIds.length !== memberIds.length) {
				return failure({
					type: "ApplicationError",
					message: "Duplicate members selected.",
				});
			}

			const selectedMembers = await db.query.members.findMany({
				columns: { id: true, memberStatus: true },
				where: inArray(members.id, uniqueMemberIds),
			});
			if (
				selectedMembers.length !== uniqueMemberIds.length ||
				selectedMembers.some((member) => member.memberStatus !== "active")
			) {
				return failure({
					type: "ApplicationError",
					message: "All selected members must be active.",
				});
			}

			const addonResult = await fetchActiveAddons(addonIds);
			if (!addonResult.success) {
				return addonResult;
			}

			// The first selected member is the billing member on the addon invoice; the
			// full selection count drives the perMember multiplier.
			const billingMemberId = uniqueMemberIds[0];
			const addonLines = buildAddonInvoiceLines(addonResult.data, {
				numberOfPeriods,
				numberOfMembers: uniqueMemberIds.length,
			});
			const addonSubtotal = sumAddonSubtotal(addonLines);

			if (toBig(addonSubtotal).lte(0)) {
				return failure({
					type: "ApplicationError",
					message: "Addon total must be greater than zero.",
				});
			}

			const settings = await db.query.settings.findFirst({
				columns: { billing: true },
			});

			// Resolve the bank/cash account — same precedence as the membership path.
			let hasSettlementAccount = false;
			let bankAccount: number;
			if (settings?.billing?.mpesaSettlementAccountId) {
				hasSettlementAccount = true;
				bankAccount = settings.billing.mpesaSettlementAccountId;
			} else {
				const fetchedAccount = await db.query.ledgerAccounts.findFirst({
					columns: { id: true },
					where: eq(sql`lower(${ledgerAccounts.name})`, "cash at bank"),
				});
				if (!fetchedAccount) {
					return failure({
						type: "ApplicationError",
						message: "No bank account configured for payments",
					});
				}
				bankAccount = fetchedAccount.id;
			}

			const result = await db.transaction(async (tx) => {
				const invoiceNo = await nextAddonInvoiceNo(tx);

				const description = `Addon payment for invoice # ${invoiceNo} - ${reference}`;

				// Same credit-redemption validation as finalizeMembershipPayment: lock
				// before reading the available balance, then validate against both the
				// invoice total and the member's actual balance.
				const hasCreditApplied = !!appliedCreditAmount && appliedCreditAmount > 0;
				if (hasCreditApplied) {
					await lockMemberCredits(tx, billingMemberId);
					if (!settings?.billing?.memberCreditsPayableAccountId) {
						return failure({
							type: "ApplicationError",
							message: "Member credits payable account is not configured",
						});
					}
					if (toBig(appliedCreditAmount).gt(addonSubtotal)) {
						return failure({
							type: "ApplicationError",
							message: "Applied credit cannot exceed the payment total.",
						});
					}
					const availableBalance = await getAvailableCreditBalance(tx, billingMemberId);
					if (toBig(appliedCreditAmount).gt(availableBalance)) {
						return failure({
							type: "ApplicationError",
							message: "Applied credit exceeds the member's available credit balance.",
						});
					}
				}
				const addonBankAmount = hasCreditApplied
					? toDecimalString(toBig(addonSubtotal).minus(appliedCreditAmount as number))
					: addonSubtotal;
				const hasBankPortion = toBig(addonBankAmount).gt(0);

				// One credit per unique addon revenue account, then debit(s): credit
				// applied (if any) then the bank portion. No membership revenue or VAT
				// lines for addon-only receipts.
				const lines = buildReceiptJournalLines({
					addonLines,
					creditApplied: hasCreditApplied
						? {
								accountId: settings!.billing!.memberCreditsPayableAccountId!,
								amount: toDecimalString(appliedCreditAmount),
							}
						: null,
					bankAccountId: hasBankPortion ? bankAccount : undefined,
					bankAmount: hasBankPortion ? addonBankAmount : undefined,
					memo: description,
				});

				if (!areJournalValuesBalanced(lines)) {
					return failure({
						type: "ApplicationError",
						message: "Journal values are not balanced",
					});
				}

				const [addonInvoice] = await tx
					.insert(addonInvoices)
					.values({
						invoiceNo,
						memberId: billingMemberId,
						paymentId: null,
						paymentDate: new Date(paymentDate),
						numberOfPeriods,
						numberOfMembers: uniqueMemberIds.length,
						subtotalAmount: addonSubtotal,
						taxAmount: "0",
						totalAmount: addonSubtotal,
						vatType: "none",
						status: "completed",
						method: "mpesa_manual",
						channel: "staff",
						reference,
						createdByUserId: userId,
					})
					.returning({ id: addonInvoices.id });

				await tx.insert(addonInvoiceLines).values(
					addonLines.map((line) => ({
						addonInvoiceId: addonInvoice.id,
						addonId: line.addonId,
						addonName: line.addonName,
						unitAmount: line.unitAmount,
						perMember: line.perMember,
						revenueAccountId: line.revenueAccountId,
						numberOfPeriods: line.numberOfPeriods,
						numberOfMembers: line.numberOfMembers,
						lineSubtotal: line.lineSubtotal,
						taxAmount: line.taxAmount,
						lineTotal: line.lineTotal,
					}))
				);

				await createJournalEntry({
					entry: {
						entryDate: dateFormat(paymentDate),
						reference: invoiceNo,
						source: "addon payment",
						sourceId: addonInvoice.id,
						description,
					},
					lines,
					tx,
				});

				if (hasSettlementAccount && hasBankPortion) {
					const bankAccountId = await tx.query.bankAccounts.findFirst({
						columns: { id: true },
						where: eq(bankAccounts.accountId, bankAccount),
					});
					if (bankAccountId?.id) {
						await createBankingEntry({
							tx,
							entry: {
								bankId: bankAccountId.id,
								dc: "debit",
								amount: addonBankAmount,
								reference,
								transactionDate: dateFormat(paymentDate),
								source: "addon payment",
								sourceId: addonInvoice.id,
								narration: description,
							},
						});
					}
				}

				if (hasCreditApplied) {
					await applyCreditRedemption({
						tx,
						memberId: billingMemberId,
						amountToApply: toDecimalString(appliedCreditAmount),
						addonInvoiceId: addonInvoice.id,
					});
				}

				await tx.insert(activityLogs).values({
					userId,
					action: "create addon receipt",
					description: `Created addon receipt ${invoiceNo}.`,
				});

				return success(addonInvoice.id);
			});

			return result;
		}
	);
