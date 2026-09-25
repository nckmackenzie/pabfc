import { formOptions } from "@tanstack/react-form";
import { nanoid } from "nanoid";
import { billSchema, type BillSchema } from "@/features/bills/services/schemas";
import { dateFormat } from "@/lib/helpers";

export const createDefaultBillLine = (): BillSchema["lines"][number] => ({
	id: nanoid(),
	accountId: "",
	vatType: "none",
	amount: 0,
	description: "",
	whtApplicable: false,
	whtRate: null,
});

export const createBillDefaultValues = (): BillSchema => ({
	invoiceDate: dateFormat(new Date()),
	vendorId: "",
	invoiceNo: "",
	isRecurring: false,
	dueDate: null,
	lines: [createDefaultBillLine()],
	terms: null,
});

/**
 * Shared form shape for the bill form and the field-group components it composes,
 * so `withForm` children stay typed against the same schema the form validates.
 */
export const billFormOpts = formOptions({
	defaultValues: createBillDefaultValues(),
	validators: {
		onSubmit: billSchema,
	},
});
