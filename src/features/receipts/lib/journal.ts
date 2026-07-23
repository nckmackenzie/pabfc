import { combineAddonRevenueLines } from "@/features/addons/lib/helpers";

export type ReceiptJournalLine = {
	lineNumber: number;
	accountId: number;
	amount: string;
	dc: "credit" | "debit";
	memo: string;
};

type BuildReceiptJournalLinesInput = {
	// Membership plan revenue (omitted for addon-only receipts).
	membershipRevenue?: { accountId: number; amount: string } | null;
	// Membership VAT (omitted when no tax applies; addons are always VAT-exempt).
	vat?: { accountId: number; amount: string } | null;
	// Addon lines, combined into one credit per unique revenue account.
	addonLines?: { revenueAccountId: number; lineSubtotal: string }[];
	// Portion of the receipt funded by a member's credit note balance (omitted when
	// no credit was applied) — a debit, same as the bank line, since it represents
	// less cash needing to move rather than a change in recognized revenue.
	creditApplied?: { accountId: number; amount: string } | null;
	// Omitted (along with bankAmount) when the receipt is fully funded by credit —
	// callers must not pass a zero bankAmount instead, since this function does not
	// filter zero-amount lines itself.
	bankAccountId?: number;
	// The cash portion received (debited to the bank/cash account).
	bankAmount?: string;
	memo: string;
};

/**
 * Builds the journal lines for a receipt: every credit (membership revenue, VAT,
 * then one combined credit per unique addon revenue account) followed by the debit(s)
 * — credit-applied then bank — numbered in order. Shared by the membership+addon and
 * addon-only payment paths so both post identically-structured, balanced entries.
 */
export function buildReceiptJournalLines({
	membershipRevenue,
	vat,
	addonLines = [],
	creditApplied,
	bankAccountId,
	bankAmount,
	memo,
}: BuildReceiptJournalLinesInput): ReceiptJournalLine[] {
	const creditLines: Omit<ReceiptJournalLine, "lineNumber">[] = [];

	if (membershipRevenue) {
		creditLines.push({
			accountId: membershipRevenue.accountId,
			amount: membershipRevenue.amount,
			dc: "credit",
			memo,
		});
	}

	if (vat) {
		creditLines.push({
			accountId: vat.accountId,
			amount: vat.amount,
			dc: "credit",
			memo,
		});
	}

	for (const { accountId, amount } of combineAddonRevenueLines(addonLines)) {
		creditLines.push({ accountId, amount, dc: "credit", memo });
	}

	const debitLines: Omit<ReceiptJournalLine, "lineNumber">[] = [];

	if (creditApplied) {
		debitLines.push({
			accountId: creditApplied.accountId,
			amount: creditApplied.amount,
			dc: "debit",
			memo,
		});
	}

	if (bankAccountId !== undefined && bankAmount !== undefined) {
		debitLines.push({ accountId: bankAccountId, amount: bankAmount, dc: "debit" as const, memo });
	}

	return [...creditLines, ...debitLines].map((line, index) => ({ ...line, lineNumber: index + 1 }));
}
