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
	bankAccountId: number;
	// The full amount received (debited to the bank/cash account).
	bankAmount: string;
	memo: string;
};

/**
 * Builds the journal lines for a receipt: every credit (membership revenue, VAT,
 * then one combined credit per unique addon revenue account) followed by the bank
 * debit last, numbered in order. Shared by the membership+addon and addon-only
 * payment paths so both post identically-structured, balanced entries.
 */
export function buildReceiptJournalLines({
	membershipRevenue,
	vat,
	addonLines = [],
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

	return [
		...creditLines,
		{ accountId: bankAccountId, amount: bankAmount, dc: "debit" as const, memo },
	].map((line, index) => ({ ...line, lineNumber: index + 1 }));
}
