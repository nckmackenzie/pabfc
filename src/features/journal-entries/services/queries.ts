import { queryOptions } from "@tanstack/react-query";
import {
	getJournalEntry,
	getJournalNo,
} from "@/features/journal-entries/services/journal-entry.api";

export const journalQueries = {
	journalNo: () =>
		queryOptions({
			queryKey: ["journal-no"],
			queryFn: () => getJournalNo(),
		}),
	journal: (journalNo: number) =>
		queryOptions({
			queryKey: ["journal", journalNo],
			queryFn: () => getJournalEntry({ data: journalNo }),
		}),
};
