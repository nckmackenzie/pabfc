import { describe, expect, it } from "vitest";
import {
	buildDecisionMessage,
	buildRequestSubmittedMessage,
	selectValidContacts,
} from "./complimentary-notifications";

describe("selectValidContacts", () => {
	it("keeps only +254XXXXXXXXX E.164 numbers", () => {
		expect(
			selectValidContacts(["+254712345001", "0712000001", null, undefined, "", "+1555123"])
		).toEqual(["+254712345001"]);
	});

	it("returns an empty array when nothing is valid", () => {
		expect(selectValidContacts([null, undefined, ""])).toEqual([]);
	});
});

describe("buildRequestSubmittedMessage", () => {
	it("includes member, plan, and requester", () => {
		const message = buildRequestSubmittedMessage({
			memberName: "Jane Doe",
			planName: "Gold Plan",
			requesterName: "John Staff",
		});
		expect(message).toContain("Jane Doe");
		expect(message).toContain("Gold Plan");
		expect(message).toContain("John Staff");
	});
});

describe("buildDecisionMessage", () => {
	it("has no reason line when approved", () => {
		const message = buildDecisionMessage({ status: "approved", rejectionReason: null });
		expect(message.toLowerCase()).toContain("approved");
		expect(message).not.toContain("Reason:");
	});

	it("includes the rejection reason when rejected", () => {
		const message = buildDecisionMessage({
			status: "rejected",
			rejectionReason: "Does not meet retention criteria",
		});
		expect(message.toLowerCase()).toContain("rejected");
		expect(message).toContain("Does not meet retention criteria");
	});
});
