import type { getPayment } from "@/features/payments/services/payments.api";
import type { PaymentFormValues } from "@/features/payments/services/schema";
import { toTitleCase } from "@/lib/utils";

export const transformPaymentFormValues = (
	payment: Awaited<ReturnType<typeof getPayment>>,
): PaymentFormValues => {
	return {
		id: payment.id,
		paymentNo: payment.paymentNo.toString(),
		vendorId: payment.vendor.id,
		paymentDate: payment.paymentDate,
		paymentMethod: payment.paymentMethod as PaymentFormValues["paymentMethod"],
		reference: payment.reference?.toUpperCase() ?? "",
		bankId: payment.bank?.id,
		cashEquivalentAccountId: payment.creditingAccountId?.toString(),
		memo: payment.memo ? toTitleCase(payment.memo) : null,
		bills: payment.lines.map((line) => ({
			selected: true,
			balance: parseFloat(line.currentBalance),
			billId: line.billId,
			amount: parseFloat(line.amount),
			invoiceDate: line.bill.invoiceDate,
			invoiceNo: line.bill.invoiceNo,
			dueDate: line.bill.dueDate,
			total: parseFloat(line.bill.total),
		})),
	};
};
