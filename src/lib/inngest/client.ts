import { EventSchemas, Inngest } from "inngest";

export type StkCallback = {
	ResultCode: number;
	ResultDesc: string;
	CheckoutRequestID: string;
	MerchantRequestID: string;
	CallbackMetadata?: {
		Item: Array<{
			Name: string;
			Value: string | number;
		}>;
	};
};

type Events = {
	"app/payments.create": {
		data: {
			checkoutRequestId: string;
			stkCallback: StkCallback;
		};
	};
	"app/communications.send-sms-broadcast": {
		data: {
			broadcastId: string;
		};
	};
	"app/communications.send-test-to-user": {
		data: {
			content: string;
			contact: Array<string>;
		};
	};
	"app/bills.update.invoice.status": {
		data: {
			paidInvoiceIds: Array<string>;
		};
	};
	"app/members.send.registration.link": {
		data: {
			memberId: string;
		};
	};
};

export const inngest = new Inngest({
	id: "pabfc",
	schemas: new EventSchemas().fromRecord<Events>(),
});
