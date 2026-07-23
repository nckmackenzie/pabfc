import { describe, expect, it } from "vitest";
import { computeRestoredCreditNoteState } from "./redemption";

describe("computeRestoredCreditNoteState", () => {
	it("moves a fully_redeemed credit note back to partially_redeemed on a partial restore", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "0.00",
			status: "fully_redeemed",
			amountToRestore: "400.00",
		});
		expect(result).toEqual({ balanceRemaining: "400.00", status: "partially_redeemed" });
	});

	it("moves a partially_redeemed credit note back to active when the full amount is restored", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "400.00",
			status: "partially_redeemed",
			amountToRestore: "600.00",
		});
		expect(result).toEqual({ balanceRemaining: "1000.00", status: "active" });
	});

	it("stays partially_redeemed when the restore doesn't bring the balance back to the full amount", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "200.00",
			status: "partially_redeemed",
			amountToRestore: "300.00",
		});
		expect(result).toEqual({ balanceRemaining: "500.00", status: "partially_redeemed" });
	});

	it("caps the restored balance at the original credited amount", () => {
		// Defensive: shouldn't happen in practice (redemptions sum to <= amount), but
		// the restore must never push balanceRemaining above the original credit.
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "900.00",
			status: "partially_redeemed",
			amountToRestore: "300.00",
		});
		expect(result).toEqual({ balanceRemaining: "1000.00", status: "active" });
	});

	it("leaves an expired credit note's status alone even when restoring its balance", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "0.00",
			status: "expired",
			amountToRestore: "400.00",
		});
		expect(result).toEqual({ balanceRemaining: "400.00", status: "expired" });
	});
});
