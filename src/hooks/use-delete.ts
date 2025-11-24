import { useQueryClient } from "@tanstack/react-query";
import { handleClientError } from "@/lib/error-handling/error-handling";

type DeleteConfig = {
	queryKey: string[];
	successMessage?: string;
	fallbackMessage?: string;
};

export function useDelete() {
	const queryClient = useQueryClient();

	return async (
		resourceId: string,
		deleteAction: (params: { data: string }) => Promise<void>,
		config: DeleteConfig,
	) => {
		try {
			await deleteAction({ data: resourceId });
			queryClient.invalidateQueries({ queryKey: config.queryKey });
			return {
				error: false,
				message: config.successMessage || "Resource deleted successfully!",
			};
		} catch (error) {
			const errorMessage = handleClientError(error, {
				fallbackMessage: config.fallbackMessage || "Error deleting resource",
			});
			return { error: true, message: errorMessage };
		}
	};
}
