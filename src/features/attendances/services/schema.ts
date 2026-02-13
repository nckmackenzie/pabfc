import { z } from "zod";

export const attendanceValidateSearch = z.object({
	q: z.string().optional(),
	from: z.iso.date().optional(),
	to: z.iso.date().optional(),
});

export type AttendanceValidateSearch = z.infer<typeof attendanceValidateSearch>;
