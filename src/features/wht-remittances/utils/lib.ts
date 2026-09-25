import type { getOutstandingWhtBills, getRemittance } from "@/features/wht-remittances/services/wht-remittances.api";
import type { RemittanceFormValues } from "@/features/wht-remittances/services/schemas";
import { toNumber } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type OutstandingWhtBill = Awaited<
	ReturnType<typeof getOutstandingWhtBills>
>[number];

/** A bill owing withholding tax, as an unselected row on the remittance form. */
export const toRemittanceBillRow = (
	bill: OutstandingWhtBill,
): RemittanceFormValues["bills"][number] => ({
	selected: false,
	billId: bill.id,
	invoiceNo: bill.invoiceNo,
	invoiceDate: bill.invoiceDate,
	vendorName: bill.name,
	taxPin: bill.taxPin,
	whtAmount: toNumber(bill.whtAmount),
	whtBalance: toNumber(bill.whtBalance),
	amount: null,
});

export const transformRemittanceFormValues = (
	remittance: Awaited<ReturnType<typeof getRemittance>>,
): RemittanceFormValues => ({
	id: remittance.id,
	remittanceNo: remittance.remittanceNo.toString(),
	remittanceDate: remittance.remittanceDate,
	// The stored remittance keeps the crediting account rather than the method it
	// was chosen by, so a bank on the record means it was paid from a bank.
	paymentMethod: remittance.bank?.id ? "bank" : "cash",
	reference: remittance.reference?.toUpperCase() ?? "",
	bankId: remittance.bank?.id,
	cashEquivalentAccountId: remittance.creditingAccountId?.toString(),
	memo: remittance.memo ? toTitleCase(remittance.memo) : null,
	bills: remittance.lines.map((line) => ({
		selected: true,
		billId: line.billId,
		invoiceNo: line.bill.invoiceNo,
		invoiceDate: line.bill.invoiceDate,
		vendorName: line.bill.vendor.name,
		taxPin: line.bill.vendor.taxPin,
		whtAmount: toNumber(line.bill.whtAmount),
		// The balance as it stood when the remittance was made, so editing shows the
		// same ceiling the original entry was capped against.
		whtBalance: toNumber(line.currentBalance),
		amount: toNumber(line.amount),
	})),
});
