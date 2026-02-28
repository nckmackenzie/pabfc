import { z } from "zod";
import { RECEIPTS_REPORT_TYPE } from "@/features/reports/lib/constants";
import { dateRangeRequiredSchema, dateRangeSchema } from "@/lib/schema-rules";

export const receiptValidateSchema = dateRangeSchema.safeExtend({
	reportType: z.enum(RECEIPTS_REPORT_TYPE.map((type) => type.value)).optional(),
	memberId: z.string().optional(),
});

export const receiptReportFormSchema = dateRangeRequiredSchema
	.safeExtend({
		reportType: z.enum(
			RECEIPTS_REPORT_TYPE.map((type) => type.value),
			{
				error: (iss) =>
					!iss.input ? "Select report type" : "Invalid report type",
			},
		),
		memberId: z.string().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.reportType === "by-member" && !data.memberId) {
			ctx.addIssue({
				code: "custom",
				message: "Select member",
				path: ["memberId"],
			});
		}
	});

export type ReceiptValidateSchema = z.infer<typeof receiptReportFormSchema>;
