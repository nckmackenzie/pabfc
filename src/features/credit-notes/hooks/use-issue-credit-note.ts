import { useMutation } from "@tanstack/react-query";
import { issueCreditNoteFn } from "@/features/credit-notes/services/credit-note.mutations.api";
import type { IssueCreditNoteSchema } from "@/features/credit-notes/services/schemas";

export function useIssueCreditNote() {
	return useMutation({
		mutationKey: ["credit-notes", "issue"],
		mutationFn: async (input: IssueCreditNoteSchema) => {
			return await issueCreditNoteFn({ data: input });
		},
	});
}
