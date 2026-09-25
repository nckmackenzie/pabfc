import { describe, expect, it } from "vitest";
import { DEFAULT_WHT_RATE } from "@/features/bills/lib/wht-constants";
import {
	resolveWhtLineDefaults,
	type SeenWhtLines,
	type WhtLineFields,
} from "@/features/bills/lib/wht-line-defaults";

const line = (overrides: Partial<WhtLineFields> = {}): WhtLineFields => ({
	id: "line-1",
	whtApplicable: false,
	whtRate: null,
	...overrides,
});

/** Replays a sequence of renders the way the hook does, threading `seen` through. */
function replay(renders: Array<Array<WhtLineFields>>) {
	let seen: SeenWhtLines = new Map();
	const perRender = renders.map((lines) => {
		const result = resolveWhtLineDefaults(lines, seen);
		seen = result.seen;
		return result.updates;
	});
	return { perRender, last: perRender[perRender.length - 1], seen };
}

describe("resolveWhtLineDefaults", () => {
	it("pre-fills the default rate when the user ticks WHT", () => {
		const { last } = replay([[line()], [line({ whtApplicable: true })]]);
		expect(last).toEqual([{ index: 0, values: { whtRate: DEFAULT_WHT_RATE } }]);
	});

	it("uses 5 as that default", () => {
		expect(DEFAULT_WHT_RATE).toBe(5);
	});

	it("leaves a rate loaded from an existing bill alone", () => {
		// Editing a saved bill: the line arrives already ticked, with its own rate.
		const { last } = replay([[line({ whtApplicable: true, whtRate: 7.5 })]]);
		expect(last).toEqual([]);
	});

	it("does not overwrite a rate the user typed over", () => {
		const { last } = replay([
			[line()],
			[line({ whtApplicable: true })],
			// Non-resident vendor: the user replaces the pre-filled 5 with 20.
			[line({ whtApplicable: true, whtRate: 20 })],
		]);
		expect(last).toEqual([]);
	});

	it("does not re-fill on every later render while WHT stays ticked", () => {
		const { perRender } = replay([
			[line()],
			[line({ whtApplicable: true })],
			[line({ whtApplicable: true, whtRate: DEFAULT_WHT_RATE })],
			[line({ whtApplicable: true, whtRate: DEFAULT_WHT_RATE })],
		]);
		expect(perRender[1]).toHaveLength(1);
		expect(perRender[2]).toEqual([]);
		expect(perRender[3]).toEqual([]);
	});

	it("clears the rate when WHT is switched off", () => {
		const { last } = replay([
			[line({ whtApplicable: true, whtRate: 5 })],
			[line({ whtApplicable: false, whtRate: 5 })],
		]);
		expect(last).toEqual([{ index: 0, values: { whtRate: null } }]);
	});

	it("does not keep clearing a line that is already clear", () => {
		const { last } = replay([[line()]]);
		expect(last).toEqual([]);
	});

	it("re-applies the default after WHT is turned off and back on", () => {
		const { last } = replay([
			[line({ whtApplicable: true, whtRate: 20 })],
			[line({ whtApplicable: false, whtRate: 20 })],
			// The rate was cleared by the step above, so ticking again pre-fills.
			[line({ whtApplicable: true, whtRate: null })],
		]);
		expect(last).toEqual([{ index: 0, values: { whtRate: DEFAULT_WHT_RATE } }]);
	});

	it("tracks lines by id, so removing one does not disturb the others", () => {
		const kept = line({ id: "b", whtApplicable: true, whtRate: 10 });
		const { last } = replay([
			[line({ id: "a", whtApplicable: true, whtRate: 5 }), kept],
			// "a" removed; "b" shifts to index 0 but was already ticked.
			[kept],
		]);
		expect(last).toEqual([]);
	});

	it("handles several lines being ticked in the same render", () => {
		const { last } = replay([
			[line({ id: "a" }), line({ id: "b" })],
			[
				line({ id: "a", whtApplicable: true }),
				line({ id: "b", whtApplicable: true }),
			],
		]);
		expect(last).toEqual([
			{ index: 0, values: { whtRate: DEFAULT_WHT_RATE } },
			{ index: 1, values: { whtRate: DEFAULT_WHT_RATE } },
		]);
	});

	it("forgets lines that are no longer present", () => {
		const { seen } = replay([
			[line({ id: "a", whtApplicable: true }), line({ id: "b" })],
			[line({ id: "b" })],
		]);
		expect([...seen.keys()]).toEqual(["b"]);
	});
});
