import { describe, expect, it } from "vitest";
import { computeRestoredCreditNoteState } from "./redemption";

describe("computeRestoredCreditNoteState", () => {
	it("moves a fully_redeemed credit note back to partially_redeemed on a partial restore", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "0.00",
			amountToRestore: "400.00",
		});
		expect(result).toEqual({ balanceRemaining: "400.00", status: "partially_redeemed" });
	});

	it("moves a partially_redeemed credit note back to active when the full amount is restored", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "400.00",
			amountToRestore: "600.00",
		});
		expect(result).toEqual({ balanceRemaining: "1000.00", status: "active" });
	});

	it("stays partially_redeemed when the restore doesn't bring the balance back to the full amount", () => {
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "200.00",
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
			amountToRestore: "300.00",
		});
		expect(result).toEqual({ balanceRemaining: "1000.00", status: "active" });
	});

	it("returns to active on a full restore from a zero balance (e.g. a fully expired or fully_redeemed note)", () => {
		// This function no longer takes the credit note's prior status — an expired
		// note restored via a void must become spendable again, not stay stuck
		// "expired" with a nonzero balance. restoreCreditNoteBalance (DB-touching,
		// not unit-tested here) is what additionally reverses the expiry write-off
		// journal when the prior status was "expired".
		const result = computeRestoredCreditNoteState({
			amount: "1000.00",
			balanceRemaining: "0.00",
			amountToRestore: "1000.00",
		});
		expect(result).toEqual({ balanceRemaining: "1000.00", status: "active" });
	});
});
