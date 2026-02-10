import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { settingsQuery } from "@/features/settings/services/queries";
import { generateFullPaymentInvoiceNo } from "@/lib/helpers";

export function useReceiptNo(reference: number) {
	const { data: settings, error, isLoading } = useQuery(settingsQuery());

	const receiptNo = useMemo(() => {
		if (!settings?.billing) return "";

		return generateFullPaymentInvoiceNo(
			reference,
			settings.billing.invoicePrefix,
			settings.billing.invoiceNumberPadding,
		);
	}, [reference, settings?.billing]);

	return { receiptNo, error, isLoading };
}
