import { z } from "zod";

export const activityLogValidateSearch = z
	.object({
		q: z.string().optional().catch(""),
		from: z.iso.date().optional().catch(""),
		to: z.iso.date().optional().catch(""),
	})
	.superRefine((data, ctx) => {
		if (data.from && data.to) {
			if (data.from > data.to) {
				ctx.addIssue({
					code: "custom",
					message: "From date must be before to date",
					path: ["from"],
				});
			}
		}
	});

export type ActivityLogSearchParams = z.infer<typeof activityLogValidateSearch>;
