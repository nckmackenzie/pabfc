import { useQueryClient } from "@tanstack/react-query";
import type { AppError, Result } from "@/lib/result";
import { failure, success } from "@/lib/result";

type DeleteConfig = {
	queryKey: string[];
	successMessage?: string;
	fallbackMessage?: string;
};

export function useDelete() {
	const queryClient = useQueryClient();

	return async (
		resourceId: string,
		deleteAction: (params: { data: string }) => Promise<Result<undefined>>,
		config: DeleteConfig,
	): Promise<Result<undefined>> => {
		try {
			const result = await deleteAction({ data: resourceId });
			if (!result.success) {
				return failure({
					type: result.error.type,
					message:
						result.error.message ??
						config.fallbackMessage ??
						"Error deleting resource",
				});
			}

			queryClient.invalidateQueries({ queryKey: config.queryKey });
			return success(undefined);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: (config.fallbackMessage ?? "Error deleting resource");
			return failure({ type: "UnknownError", message } satisfies AppError);
		}
	};
}
