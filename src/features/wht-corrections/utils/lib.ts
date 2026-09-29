import type { ComboBoxItem } from "@/components/ui/custom-select";
import type { getCorrectableBills } from "@/features/wht-corrections/services/wht-corrections.api";
import type { CorrectionLineValues } from "@/features/wht-corrections/services/schemas";
import { DEFAULT_WHT_RATE } from "@/features/bills/lib/wht-constants";
import { dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

type CorrectableBill = Awaited<ReturnType<typeof getCorrectableBills>>[number];

/** A correctable bill as a `ComboBox` option: "INV-004 · Acme Consulting". */
export const toBillComboboxItem = (bill: CorrectableBill): ComboBoxItem => ({
	value: bill.id,
	label: `${bill.invoiceNo} · ${toTitleCase(bill.vendorName)} (${dateFormat(bill.invoiceDate, "reporting")})`,
});

/** A blank correction line, appended by the form's "Add Line" button. */
export const newCorrectionLine = (): CorrectionLineValues => ({
	billId: "",
	whtCategory: "professional_management_training_fee",
	whtRate: DEFAULT_WHT_RATE,
	amount: 0,
});
