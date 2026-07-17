import { toBig, toDecimalString } from "@/lib/helpers";

// The live/snapshotted addon fields needed to price a line. Kept minimal so both
// the live `addons` record and a persisted `addon_invoice_lines` row satisfy it.
export type PriceableAddon = {
	id: string;
	name: string;
	amount: string;
	perMember: boolean;
	revenueAccountId: number;
};

export type ComputedAddonLine = {
	addonId: string;
	addonName: string;
	unitAmount: string;
	perMember: boolean;
	revenueAccountId: number;
	numberOfPeriods: number;
	numberOfMembers: number;
	lineSubtotal: string;
	taxAmount: string;
	lineTotal: string;
};

/**
 * lineSubtotal = unitAmount × numberOfPeriods × (numberOfMembers if perMember else 1)
 *
 * Addons are always VAT-exempt, so taxAmount is 0 and lineTotal === lineSubtotal.
 */
export function computeAddonLineSubtotal(
	unitAmount: string | number,
	numberOfPeriods: number,
	numberOfMembers: number,
	perMember: boolean,
): string {
	const memberMultiplier = perMember ? numberOfMembers : 1;
	return toDecimalString(
		toBig(unitAmount).times(numberOfPeriods).times(memberMultiplier),
	);
}

/**
 * Builds the persisted line shape for each selected addon, snapshotting the addon's
 * name, unit amount, perMember flag and revenue account at creation time.
 */
export function buildAddonInvoiceLines(
	addons: PriceableAddon[],
	{
		numberOfPeriods,
		numberOfMembers,
	}: { numberOfPeriods: number; numberOfMembers: number },
): ComputedAddonLine[] {
	return addons.map((addon) => {
		const lineSubtotal = computeAddonLineSubtotal(
			addon.amount,
			numberOfPeriods,
			numberOfMembers,
			addon.perMember,
		);
		// VAT-exempt: no tax, total equals subtotal.
		const taxAmount = "0.00";
		return {
			addonId: addon.id,
			addonName: addon.name,
			unitAmount: toDecimalString(addon.amount),
			perMember: addon.perMember,
			revenueAccountId: addon.revenueAccountId,
			numberOfPeriods,
			numberOfMembers,
			lineSubtotal,
			taxAmount,
			lineTotal: lineSubtotal,
		};
	});
}

/**
 * An addon may only be hard-deleted when nothing references it; otherwise it is
 * soft-deleted (active = false) so historical invoice lines keep their FK.
 */
export function resolveAddonDeleteStrategy(
	hasInvoiceLines: boolean,
): "soft" | "hard" {
	return hasInvoiceLines ? "soft" : "hard";
}

export function sumAddonSubtotal(lines: { lineSubtotal: string }[]): string {
	return toDecimalString(
		lines.reduce((total, line) => total.plus(toBig(line.lineSubtotal)), toBig(0)),
	);
}

/**
 * Collapses addon lines into one credit amount per unique revenue account, so a
 * single journal CR line is posted per account even when several addons share it.
 * Returns entries sorted by accountId for deterministic line ordering.
 */
export function combineAddonRevenueLines(
	lines: { revenueAccountId: number; lineSubtotal: string }[],
): Array<{ accountId: number; amount: string }> {
	const totals = new Map<number, ReturnType<typeof toBig>>();
	for (const line of lines) {
		const current = totals.get(line.revenueAccountId) ?? toBig(0);
		totals.set(line.revenueAccountId, current.plus(toBig(line.lineSubtotal)));
	}
	return [...totals.entries()]
		.sort(([a], [b]) => a - b)
		.map(([accountId, amount]) => ({
			accountId,
			amount: toDecimalString(amount),
		}));
}
