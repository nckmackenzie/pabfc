import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
	getCorrectableBills,
	getCorrection,
	getCorrectionNo,
	getCorrections,
	getExistingCorrectionsForBills,
} from "@/features/wht-corrections/services/wht-corrections.api";
import type { searchValidateSchema } from "@/lib/schema-rules";

export const correctionQueries = {
	all: ["wht-corrections"] as const,
	correctionNo: () =>
		queryOptions({
			queryKey: [...correctionQueries.all, "correctionNo"],
			queryFn: () => getCorrectionNo(),
		}),
	correctableBills: () =>
		queryOptions({
			queryKey: [...correctionQueries.all, "correctable-bills"],
			queryFn: () => getCorrectableBills(),
		}),
	existingCorrectionsForBills: (billIds: Array<string>) =>
		queryOptions({
			queryKey: [...correctionQueries.all, "existing-for-bills", billIds],
			queryFn: () => getExistingCorrectionsForBills({ data: billIds }),
			enabled: billIds.length > 0,
		}),
	list: (filters: z.infer<typeof searchValidateSchema>) =>
		queryOptions({
			queryKey: [...correctionQueries.all, "list", filters],
			queryFn: () => getCorrections({ data: filters }),
		}),
	detail: (correctionId: string) =>
		queryOptions({
			queryKey: [...correctionQueries.all, "detail", correctionId],
			queryFn: () => getCorrection({ data: correctionId }),
		}),
};
