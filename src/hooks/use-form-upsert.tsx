import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { ToastContent } from "@/components/ui/toast-content";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import type { AppError, Result } from "@/lib/result";
import type { Route } from "@/types/index.types";

interface UseFormMutationOptions<TData, TResult = void> {
	upsertFn: (data: TData) => Promise<Result<TResult>>;
	entityName: string;
	navigateTo?: Route;
	queryKey: string[];
	successMessage?: {
		create?: string;
		update?: string;
	};
	errorMessage?: {
		create?: string;
		update?: string;
	};
	onSuccessCallback?: (result: TResult, isEdit: boolean) => void;
	onErrorCallback?: (error: AppError, isEdit: boolean) => void;
	displaySuccessToast?: boolean;
	onReset?: () => void;
}

export function useFormUpsert<TData, TResult = void>({
	upsertFn,
	entityName,
	navigateTo,
	queryKey,
	successMessage,
	errorMessage,
	onSuccessCallback,
	onErrorCallback,
	displaySuccessToast = true,
	onReset,
}: UseFormMutationOptions<TData, TResult>) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation({
		mutationFn: async (data: TData) => {
			const result = await upsertFn(data);
			if (!result.success) {
				throw result.error;
			}
			return result;
		},
		onError: (error, variables) => {
			const isEdit = !!(variables as { id?: unknown })?.id;
			if (error && typeof error === "object" && "type" in error) {
				const appError = error as AppError;
				onErrorCallback?.(appError, isEdit);

				if (appError.type === "AuthenticationError") {
					toast.error((t) => (
						<ToastContent
							t={t}
							title="Unauthenticated request!"
							message="You need to be logged in to perform this action!"
						/>
					));
					navigate({ to: "/sign-in" });
					return;
				}

				toast.error((t) => <ToastContent t={t} title="Error" message={appError.message} />);
				return;
			}

			// Network / runtime Error
			const defaultMessage = isEdit
				? `Error updating ${entityName.toLowerCase()}`
				: `Error creating ${entityName.toLowerCase()}`;

			let title = "Error";
			let message = isEdit
				? errorMessage?.update || defaultMessage
				: errorMessage?.create || defaultMessage;

			if (error instanceof Error) {
				const parsed = parseErrorMessage(error);
				title = parsed.title;
				message = parsed.message;
			}

			toast.error((t) => <ToastContent t={t} title={title} message={message} />);
		},
		onSuccess: (result, variables) => {
			const isEdit = !!(variables as { id?: unknown })?.id;
			const action = isEdit ? "updated" : "created";
			const defaultMessage = `${entityName} has been ${action} successfully.`;

			const message = isEdit
				? successMessage?.update || defaultMessage
				: successMessage?.create || defaultMessage;

			if (displaySuccessToast) {
				toast.success((t) => <ToastContent t={t} title="Success" message={message} />);
			}

			onReset?.();

			queryClient.invalidateQueries({ queryKey });
			onSuccessCallback?.(result.data, isEdit);

			if (navigateTo) {
				setTimeout(() => {
					navigate({ to: navigateTo });
				}, 0);
			}
		},
	});
}
