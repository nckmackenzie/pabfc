import { z } from "zod";

export const journalEntrySchema = z.object({
	id: z.string().optional(),
	date: z.iso
		.date()
		.refine(
			(date) =>
				new Date(date).setHours(0, 0, 0, 0) <= new Date().setHours(0, 0, 0, 0),
			{
				message: "Date must be today or in the past",
			},
		),
	journalNo: z.number(),
	journalLines: z.array(
		z
			.object({
				id: z.string(),
				accountId: z.string().min(1, { error: "Account is required" }),
				debit: z.number().nullish(),
				credit: z.number().nullish(),
				description: z.string().nullish(),
			})
			.refine((data) => data.debit !== null && data.credit !== null, {
				message: "Debit or Credit is required",
			}),
	),
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;
