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
	ledgerAccounts,
	memberMemberships,
	members,
	mpesaStkRequests,
	paymentMembers,
	payments,
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
import { areJournalValuesBalanced, createJournalEntry } from "@/services/journal";
import { createBankingEntry } from "@/services/banking";
import { getPaymentNo } from "@/features/receipts/services/payments.queries.api";
import { addonOnlyPaymentSchema, paymentSchema } from "@/features/receipts/services/schemas";
import {
	computeMembershipEndDate,
	membershipRangeConflicts,
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

			const { memberIds, addonIds, paymentDate, numberOfPeriods, reference } = data;

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

				// One credit per unique addon revenue account, then the bank debit for
				// the total. No membership revenue or VAT lines for addon-only receipts.
				const lines = buildReceiptJournalLines({
					addonLines,
					bankAccountId: bankAccount,
					bankAmount: addonSubtotal,
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

				if (hasSettlementAccount) {
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
								amount: addonSubtotal,
								reference,
								transactionDate: dateFormat(paymentDate),
								source: "addon payment",
								sourceId: addonInvoice.id,
								narration: description,
							},
						});
					}
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
