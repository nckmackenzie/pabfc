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
};

export const inngest = new Inngest({
	id: "pabfc",
	schemas: new EventSchemas().fromRecord<Events>(),
});
