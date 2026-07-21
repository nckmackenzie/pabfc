import { createServerFn } from "@tanstack/react-start";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
	addonInvoices,
	memberMemberships,
	members,
	membershipPlans,
	mpesaStkRequests,
	payments,
} from "@/drizzle/schema";
import { requireAnyPermission } from "@/lib/permissions/permissions";
import { searchValidateSchema } from "@/lib/schema-rules";
import { authMiddleware } from "@/middlewares/auth-middleware";
import type { VatType } from "@/drizzle/schema";

export const getPaymentStatusFn = createServerFn()
	.middleware([authMiddleware])
	.validator((checkoutRequestId: string) => checkoutRequestId)
	.handler(async ({ data: checkoutRequestId }) => {
		const payment = await db.query.mpesaStkRequests.findFirst({
			where: eq(mpesaStkRequests.checkoutRequestId, checkoutRequestId),
		});

		if (!payment) {
			return { exists: false } as const;
		}

		return {
			exists: true,
			status: payment.status,
			amount: payment.amount,
			phoneNumber: payment.phoneNumber,
		} as const;
	});

export const getPaymentNo = createServerFn()
	.middleware([authMiddleware])
	.handler(async () => {
		const { rows } = await db.execute<{ maxno: number }>(
			sql`SELECT coalesce(MAX(CAST(payment_no AS integer)), 0) as maxno FROM payments`
		);
		return +rows[0].maxno + 1;
	});

// The effective membership tax type staff need to preview a receipt total. Mirrors
// the server-side derivation in createManualMembershipPaymentFn so the preview and
// the recorded amount agree. Scoped to receipt permissions (unlike admin getSettings).
export const getMembershipTaxType = createServerFn()
	.middleware([authMiddleware])
	.handler(async (): Promise<{ taxType: VatType }> => {
		await requireAnyPermission(["receipts:create", "receipts:view"]);

		const settings = await db.query.settings.findFirst({
			columns: { billing: true },
		});
		const taxType: VatType = settings?.billing?.applyTaxToMembership
			? (settings.billing?.vatType ?? "inclusive")
			: "none";
		return { taxType };
	});

export const getPayments = createServerFn()
	.middleware([authMiddleware])
	.validator(searchValidateSchema)
	.handler(async ({ data: { q } }) => {
		// Membership payments (may also carry addons). "Amount" reflects the actual
		// total paid (incl. VAT and any addons), not just the membership line total.
		const membershipRows = await db
			.select({
				id: payments.id,
				type: sql<"membership">`'membership'`,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				image: members.image,
				memberCount:
					sql<number>`(select count(*) from payment_members pm where pm.payment_id = ${payments.id})`.mapWith(
						Number
					),
				plan: sql<string | null>`${membershipPlans.name}`,
				paymentNo: payments.paymentNo,
				amount: payments.totalAmount,
				reference: payments.reference,
				paymentDate: payments.paymentDate,
				channel: payments.channel,
				status: payments.status,
			})
			.from(payments)
			.innerJoin(members, eq(payments.memberId, members.id))
			.innerJoin(membershipPlans, eq(payments.planId, membershipPlans.id))
			.where(
				q
					? or(
							ilike(members.firstName, `%${q}%`),
							ilike(members.lastName, `%${q}%`),
							ilike(membershipPlans.name, `%${q}%`),
							ilike(payments.paymentNo, `%${q}%`),
							ilike(payments.reference, `%${q}%`),
							ilike(sql`CAST(${payments.totalAmount} AS TEXT)`, `%${q}%`),
							ilike(sql`CAST(${payments.paymentDate} AS TEXT)`, `%${q}%`)
						)
					: undefined
			);

		// Standalone addon-only receipts write only to addon_invoices, so they must be
		// surfaced here too, otherwise they'd be unreachable after creation.
		const addonRows = await db
			.select({
				id: addonInvoices.id,
				type: sql<"addon">`'addon'`,
				memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
				image: members.image,
				memberCount: addonInvoices.numberOfMembers,
				plan: sql<string | null>`NULL`,
				paymentNo: addonInvoices.invoiceNo,
				amount: addonInvoices.totalAmount,
				reference: addonInvoices.reference,
				paymentDate: addonInvoices.paymentDate,
				channel: addonInvoices.channel,
				status: addonInvoices.status,
			})
			.from(addonInvoices)
			.innerJoin(members, eq(addonInvoices.memberId, members.id))
			.where(
				and(
					isNull(addonInvoices.paymentId),
					q
						? or(
								ilike(members.firstName, `%${q}%`),
								ilike(members.lastName, `%${q}%`),
								ilike(addonInvoices.invoiceNo, `%${q}%`),
								ilike(addonInvoices.reference, `%${q}%`),
								ilike(sql`CAST(${addonInvoices.totalAmount} AS TEXT)`, `%${q}%`),
								ilike(sql`CAST(${addonInvoices.paymentDate} AS TEXT)`, `%${q}%`)
							)
						: undefined
				)
			);

		return [...membershipRows, ...addonRows].sort(
			(a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
		);
	});

export const getPayment = createServerFn()
	.middleware([authMiddleware])
	.validator((id: string) => id)
	.handler(async ({ data: id }) => {
		const payment = await db.query.payments.findFirst({
			with: {
				member: {
					columns: {
						firstName: true,
						lastName: true,
						image: true,
						memberNo: true,
					},
				},
				members: {
					with: {
						member: {
							columns: {
								firstName: true,
								lastName: true,
								image: true,
								memberNo: true,
							},
						},
					},
				},
				plan: { columns: { name: true, price: true } },
				user: { columns: { name: true } },
				voidedByUser: { columns: { name: true } },
				addonInvoices: {
					with: { lines: true },
				},
			},
			where: eq(payments.id, id),
		});

		if (!payment) return null;

		const membership = await db.query.memberMemberships.findFirst({
			where: eq(memberMemberships.paymentId, id),
			columns: {
				startDate: true,
				endDate: true,
				status: true,
				autoRenew: true,
			},
		});

		// A membership payment has at most one addon invoice attached.
		const { addonInvoices: attachedAddonInvoices, ...paymentRest } = payment;

		return {
			...paymentRest,
			membership,
			addonInvoice: attachedAddonInvoices[0] ?? null,
		};
	});
