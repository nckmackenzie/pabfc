import { describe, expect, it } from "vitest";
import { runPaymentPostCommitTasks } from "./payment-post-commit";

describe("runPaymentPostCommitTasks", () => {
	it("resolves and attempts event dispatch when activity logging rejects", async () => {
		const attempts: string[] = [];
		const errors: string[] = [];

		await expect(
			runPaymentPostCommitTasks(
				[
					{
						name: "activity log",
						run: async () => {
							attempts.push("activity log");
							throw new Error("activity unavailable");
						},
					},
					{
						name: "invoice status event",
						run: async () => {
							attempts.push("invoice status event");
						},
					},
				],
				(message) => errors.push(message)
			)
		).resolves.toBeUndefined();

		expect(attempts).toEqual(["activity log", "invoice status event"]);
		expect(errors).toEqual(["Post-commit payment activity log failed"]);
	});

	it("resolves when invoice-status dispatch rejects", async () => {
		const attempts: string[] = [];
		const errors: string[] = [];

		await expect(
			runPaymentPostCommitTasks(
				[
					{
						name: "activity log",
						run: async () => {
							attempts.push("activity log");
						},
					},
					{
						name: "invoice status event",
						run: async () => {
							attempts.push("invoice status event");
							throw new Error("inngest unavailable");
						},
					},
				],
				(message) => errors.push(message)
			)
		).resolves.toBeUndefined();

		expect(attempts).toEqual(["activity log", "invoice status event"]);
		expect(errors).toEqual(["Post-commit payment invoice status event failed"]);
	});

	it("resolves and attempts every report when the reporter throws", async () => {
		let reportAttempts = 0;

		await expect(
			runPaymentPostCommitTasks(
				[
					{
						name: "activity log",
						run: async () => {
							throw new Error("activity unavailable");
						},
					},
					{
						name: "invoice status event",
						run: async () => {
							throw new Error("inngest unavailable");
						},
					},
				],
				() => {
					reportAttempts += 1;
					throw new Error("reporting unavailable");
				}
			)
		).resolves.toBeUndefined();

		expect(reportAttempts).toBe(2);
	});
});
