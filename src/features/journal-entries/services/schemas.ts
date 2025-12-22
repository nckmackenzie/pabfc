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
				debit: z.number().optional(),
				credit: z.number().optional(),
				description: z.string().nullish(),
			})
			.refine(
				({ credit, debit }) =>
					(debit !== undefined && debit > 0) ||
					(credit !== undefined && credit > 0),
				{
					message: "Debit or Credit is required",
					path: ["credit"],
				},
			),
	),
});

export const journalEntryValidateSearch = z.object({
	journalNo: z
		.number({ error: "Journal No is required and has to be a number" })
		.optional(),
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;

export type JournalEntryValidateSearch = z.infer<
	typeof journalEntryValidateSearch
>;
