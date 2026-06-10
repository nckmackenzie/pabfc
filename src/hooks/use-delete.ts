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
		deleteAction: (params: { data: string }) => Promise<unknown>,
		config: DeleteConfig,
	): Promise<Result<undefined>> => {
		try {
			const result = await deleteAction({ data: resourceId });
			const res = result as
				| { success?: boolean; error?: { message?: string } }
				| undefined;

			if (res && res.success === false) {
				return failure({
					type: "ApplicationError",
					message:
						res.error?.message ??
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
