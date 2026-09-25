import { useEffect, useRef } from "react";
import {
	resolveWhtLineDefaults,
	type SeenWhtLines,
	type WhtLineFields,
	type WhtLineUpdate,
} from "@/features/bills/lib/wht-line-defaults";

type SetLineWhtRate = (index: number, values: WhtLineUpdate["values"]) => void;

/**
 * Keeps each bill line's withholding rate coherent as the user edits. The rules
 * live in `resolveWhtLineDefaults`; this hook only holds the state between renders
 * and applies whatever that function decides.
 */
export function useWhtLineDefaults(
	lines: Array<WhtLineFields>,
	setLineWhtRate: SetLineWhtRate,
) {
	const seenLines = useRef<SeenWhtLines>(new Map());

	useEffect(() => {
		const { updates, seen } = resolveWhtLineDefaults(lines, seenLines.current);
		seenLines.current = seen;

		for (const update of updates) {
			setLineWhtRate(update.index, update.values);
		}
	}, [lines, setLineWhtRate]);
}
