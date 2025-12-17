import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { ToastContent } from "@/components/ui/toast-content";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import type { Route } from "@/types/index.types";

interface UseFormMutationOptions<
	TData extends { id?: string },
	TResult = void,
> {
	upsertFn: (data: TData) => Promise<TResult>;
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
	displaySuccessToast?: boolean;
	onReset?: () => void;
}

export function useFormUpsert<TData extends { id?: string }, TResult = void>({
	upsertFn,
	entityName,
	navigateTo,
	queryKey,
	successMessage,
	errorMessage,
	onSuccessCallback,
	displaySuccessToast = true,
	onReset,
}: UseFormMutationOptions<TData, TResult>) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation({
		mutationFn: async (data: TData) => {
			return await upsertFn(data);
		},
		onError: (error, variables) => {
			const isEdit = !!variables.id;
			let title: string;
			let message: string;

			if (error instanceof Error) {
				const parsed = parseErrorMessage(error);
				title = parsed.title;
				message = parsed.message;
			} else {
				const defaultMessage = isEdit
					? `Error updating ${entityName.toLowerCase()}`
					: `Error creating ${entityName.toLowerCase()}`;

				title = "Error";
				message = isEdit
					? errorMessage?.update || defaultMessage
					: errorMessage?.create || defaultMessage;
			}

			toast.error((t) => (
				<ToastContent t={t} title={title} message={message} />
			));
		},
		onSuccess: (result, variables) => {
			const isEdit = !!variables.id;
			const action = isEdit ? "updated" : "created";
			const defaultMessage = `${entityName} has been ${action} successfully.`;

			const message = isEdit
				? successMessage?.update || defaultMessage
				: successMessage?.create || defaultMessage;

			if (displaySuccessToast) {
				toast.success((t) => (
					<ToastContent t={t} title="Success" message={message} />
				));
			}

			onReset?.();

			queryClient.invalidateQueries({ queryKey });
			onSuccessCallback?.(result, isEdit);

			if (navigateTo) {
				setTimeout(() => {
					navigate({ to: navigateTo });
				}, 0);
			}
		},
	});
}
