import { updatePaidInvoiceStatus } from "@/lib/inngest/functions/bills";
import {
	sendRegistrationLink,
	sendSmsBroadcast,
	sendTestSmsToUser,
} from "@/lib/inngest/functions/communications";
import { createPayment } from "@/lib/inngest/functions/payments";

export const functions = [
	createPayment,
	sendSmsBroadcast,
	sendTestSmsToUser,
	updatePaidInvoiceStatus,
	sendRegistrationLink,
];
