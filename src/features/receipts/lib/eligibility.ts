import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import type { db } from "@/drizzle/db";
import { memberMemberships } from "@/drizzle/schema";
import type { Transaction } from "@/features/receipts/services/membership-payment-finalizer";

// Both the Void and Upgrade eligibility checks need read access to the same tables,
// but only Void runs inside a transaction when it matters (the write path); the
// Upgrade route's loader needs a read-only check outside of any transaction too.
export type DbClient = Transaction | typeof db;

// A member has "renewed" if any other membership row of theirs (not created by
// `excludePaymentId`) starts later than `afterStartDate`. Shared by the Void and
// Upgrade eligibility checks, which both need to confirm a payment still represents
// the member's latest membership before allowing a destructive/retroactive action.
export async function findLaterMembership(
	dbOrTx: DbClient,
	memberId: string,
	excludePaymentId: string,
	afterStartDate: string
) {
	return dbOrTx.query.memberMemberships.findFirst({
		where: and(
			eq(memberMemberships.memberId, memberId),
			or(ne(memberMemberships.paymentId, excludePaymentId), isNull(memberMemberships.paymentId)),
			gt(memberMemberships.startDate, afterStartDate)
		),
		orderBy: (row, { asc }) => [asc(row.startDate)],
	});
}
