import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { journalEntries, journalLines } from "@/drizzle/schema";
import { journalEntrySchema } from "@/features/journal-entries/services/schemas";
import { ApplicationError } from "@/lib/error-handling/app-error";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { logActivity } from "@/services/activity-logger";
export const getJournalNo = createServerFn().handler(async () => {
	const { rows } = await db.execute<{ journalNo: number }>(
		sql`SELECT COALESCE(MAX(journal_no),0) + 1 as "journalNo" FROM journal_entries`,
	);
	return rows[0].journalNo;
});

export const upsertJournalEntries = createServerFn()
	.middleware([authMiddleware])
	.inputValidator(journalEntrySchema)
	.handler(
		async ({
			data,
			context: {
				user: { id: userId },
			},
		}) => {
			const { journalNo: formJournalNo, journalLines: lines, date, id } = data;

			const journalNo = id ? formJournalNo : await getJournalNo();
			const { totalDebits, totalCredits } = lines.reduce(
				(acc, line) => {
					acc.totalDebits += line.debit || 0;
					acc.totalCredits += line.credit || 0;
					return acc;
				},
				{ totalDebits: 0, totalCredits: 0 },
			);
			if (totalDebits !== totalCredits) {
				throw new ApplicationError("Debits and credits must be equal");
			}

			const journalId = await db.transaction(async (tx) => {
				let jid: string | undefined;
				if (!id) {
					const [{ id: createdId }] = await tx
						.insert(journalEntries)
						.values({
							journalNo,
							entryDate: date,
							source: "journal",
							sourceId: journalNo.toString(),
						})
						.returning({ id: journalEntries.id });
					jid = createdId.toString();
				} else {
					jid = id;
					await tx
						.update(journalEntries)
						.set({
							journalNo,
							entryDate: date,
							source: "journal",
							sourceId: journalNo.toString(),
						})
						.where(eq(journalEntries.id, +id));
					await tx
						.delete(journalLines)
						.where(eq(journalLines.journalEntryId, +id));
				}

				const formattedLines = lines.map((line, index) => ({
					journalEntryId: +jid,
					accountId: parseInt(line.accountId, 10),
					dc: line.debit ? "debit" : ("credit" as "debit" | "credit"),
					amount:
						line.debit && line.debit > 0
							? line.debit.toString()
							: line.credit?.toString() || "0",
					lineNumber: index + 1,
					memo: line.description?.toLowerCase(),
				}));

				await tx.insert(journalLines).values(formattedLines);

				await logActivity({
					data: {
						action: id ? "update journal" : "create journal",
						description: id
							? `Updated journal ${journalNo}`
							: `Created journal ${journalNo}`,
						userId,
					},
				});

				return jid;
			});

			return journalId;
		},
	);
