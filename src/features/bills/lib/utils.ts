import type { getBillById } from "@/features/bills/services/bills.api";
import type { BillSchema } from "@/features/bills/services/schemas";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export const getBillFormValues = (
	bill: Awaited<ReturnType<typeof getBillById>>,
	clonedValues?: boolean,
): BillSchema => {
	return {
		id: clonedValues ? undefined : bill.id,
		invoiceDate: clonedValues ? dateFormat(new Date()) : bill.invoiceDate,
		vendorId: bill.vendorId,
		invoiceNo: clonedValues ? "" : bill.invoiceNo?.toUpperCase(),
		isRecurring: bill.isRecurring,
		dueDate: clonedValues ? null : bill.dueDate,
		lines: bill.items.map((lines) => ({
			id: lines.id.toString(),
			expenseAccountId: lines.expenseAccountId.toString(),
			vatType: lines.vatType,
			description: lines.description ? toTitleCase(lines.description) : "",
			amount:
				lines.vatType === "inclusive"
					? Number(lines.total)
					: Number(lines.subTotal),
		})),
		terms: bill.terms,
	};
};
