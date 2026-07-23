import { queryOptions } from "@tanstack/react-query";
import {
	getCreditableMembershipsFn,
	getCreditNoteFn,
	getCreditNoteIssuanceContextFn,
	getCreditNotesFn,
} from "@/features/credit-notes/services/credit-note.queries.api";
import type { CreditNotesSearchValidateSchema } from "@/features/credit-notes/services/schemas";

export const creditNoteQueries = {
	all: ["credit-notes"] as const,
	list: (filters: CreditNotesSearchValidateSchema) =>
		queryOptions({
			queryKey: [...creditNoteQueries.all, "list", filters],
			queryFn: () => getCreditNotesFn({ data: filters }),
			refetchInterval: 30_000,
		}),
	detail: (id: string) =>
		queryOptions({
			queryKey: [...creditNoteQueries.all, "detail", id],
			queryFn: () => getCreditNoteFn({ data: id }),
		}),
	creditableMemberships: (memberId: string) =>
		queryOptions({
			queryKey: [...creditNoteQueries.all, "creditable-memberships", memberId],
			queryFn: () => getCreditableMembershipsFn({ data: memberId }),
		}),
	issuanceContext: (membershipId: string) =>
		queryOptions({
			queryKey: [...creditNoteQueries.all, "issuance-context", membershipId],
			queryFn: () => getCreditNoteIssuanceContextFn({ data: membershipId }),
		}),
};
