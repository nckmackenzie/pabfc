import type { VatType } from "@/drizzle/schema";
import { taxCalculator } from "@/lib/helpers";

export const calculateExpenseRequest = (
	details: {
		quantity: number | string;
		unitPrice: number | string;
		vatType: VatType;
		accountId: string;
	}[],
) => {
	let subTotal = 0;
	let taxAmount = 0;
	let grandTotal = 0;

	// Calculate line items and accumulate totals
	const lines = details.map((item) => {
		const quantity = parseFloat(item.quantity?.toString() || "0");
		const unitPrice = parseFloat(item.unitPrice?.toString() || "0");
		const lineAmount = quantity * unitPrice;

		const taxResult = taxCalculator(lineAmount, item.vatType || "none");

		subTotal += taxResult.amountExlusiveTax;
		taxAmount += taxResult.taxAmount;
		grandTotal += taxResult.totalInclusiveTax;

		return {
			...item,
			quantity,
			unitPrice,
			lineAmount,
			...taxResult,
		};
	});

	return {
		subTotal,
		taxAmount,
		grandTotal,
		lines,
	};
};
