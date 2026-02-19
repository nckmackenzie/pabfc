import { z } from "zod";

export const financialYearSchema = z
	.object({
		id: z.string().optional(),
		name: z.string().min(1, "Name is required"),
		startDate: z.iso.date({ error: "Start date is required" }),
		endDate: z.iso.date({ error: "End date is required" }),
		closed: z.boolean(),
		closedDate: z.iso.date().nullish(),
	})
	.superRefine((data, ctx) => {
		if (
			new Date(data.endDate).setHours(23, 59, 59, 999) <
			new Date(data.startDate).setHours(23, 59, 59, 999)
		) {
			ctx.addIssue({
				code: "custom",
				message: "End date must be after start date",
				path: ["endDate"],
			});
		}

		if (data.closed && !data.closedDate) {
			ctx.addIssue({
				code: "custom",
				message: "Closed date is required when year is closed",
				path: ["closedDate"],
			});
		}
	});

export type FinancialYearSchema = z.infer<typeof financialYearSchema>;
