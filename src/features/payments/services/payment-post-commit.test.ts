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
});
