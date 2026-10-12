import { z } from "zod";
import { nairobiToday } from "@/lib/nairobi-time";

const currentDateSearchValue = () =>
	z.preprocess((value) => value ?? nairobiToday(), z.iso.date());

export const attendanceValidateSearch = z
	.object({
		q: z.string().optional(),
		from: currentDateSearchValue(),
		to: currentDateSearchValue(),
	})
	.superRefine((data, ctx) => {
		if (
			new Date(data.from).setHours(0, 0, 0, 0) >
			new Date(data.to).setHours(0, 0, 0, 0)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Start date cannot be after end date",
				path: ["from"],
			});
		}
	});

export type AttendanceValidateSearch = z.infer<typeof attendanceValidateSearch>;
