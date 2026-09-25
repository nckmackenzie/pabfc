import { DEFAULT_WHT_RATE } from "@/features/bills/lib/wht-constants";
import type { BillLineSchema } from "@/features/bills/services/schemas";

export type WhtLineFields = Pick<
	BillLineSchema,
	"id" | "whtApplicable" | "whtRate"
>;

export type WhtLineUpdate = {
	index: number;
	values: { whtRate: number | null };
};

/**
 * Whether each line's WHT checkbox was ticked as last seen, keyed by line id. A
 * line absent from the map has not been observed yet, which is how a first render
 * is told apart from an edit.
 */
export type SeenWhtLines = Map<string, boolean>;

/**
 * Decides which withholding rates need correcting after an edit, and what the new
 * "seen" state is. Pure so the rules can be tested directly; the hook that wraps
 * it only owns the ref and the effect.
 *
 * The rules:
 * - Ticking the WHT checkbox pre-fills `DEFAULT_WHT_RATE` when no rate is set yet.
 * - A rate that arrived with an existing bill, or one the user typed, is never
 *   overwritten — the pre-fill only happens on the transition into "withheld".
 * - Clearing the checkbox clears the rate with it, so a line the user changed
 *   their mind about cannot fail validation on a stale value.
 */
export function resolveWhtLineDefaults(
	lines: Array<WhtLineFields>,
	seen: SeenWhtLines,
): { updates: Array<WhtLineUpdate>; seen: SeenWhtLines } {
	const updates: Array<WhtLineUpdate> = [];
	const nextSeen: SeenWhtLines = new Map();

	lines.forEach((line, index) => {
		const applicable = Boolean(line.whtApplicable);
		const wasSeen = seen.has(line.id);
		const wasApplicable = seen.get(line.id) ?? false;
		nextSeen.set(line.id, applicable);

		if (!applicable) {
			if (line.whtRate != null) {
				updates.push({ index, values: { whtRate: null } });
			}
			return;
		}

		// Only the transition into "withheld" pre-fills. A line that arrives already
		// ticked (editing an existing bill) keeps whatever rate it was saved with.
		const justEnabled = wasSeen && !wasApplicable;
		if (justEnabled && line.whtRate == null) {
			updates.push({ index, values: { whtRate: DEFAULT_WHT_RATE } });
		}
	});

	return { updates, seen: nextSeen };
}
