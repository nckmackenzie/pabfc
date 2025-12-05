import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { ToastContent } from "@/components/ui/toast-content";
import { parseErrorMessage } from "@/lib/error-handling/error-handling";
import type { Route } from "@/types/index.types";

interface UseFormMutationOptions<TData, TResult = void> {
	actionFn: (data: TData) => Promise<TResult>;
	navigateTo?: Route;
	queryKey: string[];
	errorMessage?: string;
	displaySuccessToast?: boolean;
	onReset?: () => void;
}

export function useSettingsMutation<TData, TResult = void>({
	actionFn,
	navigateTo,
	queryKey,
	errorMessage,
	displaySuccessToast = true,
	onReset,
}: UseFormMutationOptions<TData, TResult>) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	return useMutation({
		mutationFn: async ({ data }: { data: TData }) => {
			return await actionFn(data);
		},
		onError: (error) => {
			let title: string;
			let message: string;

			if (error instanceof Error) {
				const parsed = parseErrorMessage(error);
				title = parsed.title;
				message = parsed.message;
			} else {
				// Fallback for non-Error objects
				title = "Error";
				message = errorMessage || `Error updating settings`;
			}

			toast.error((t) => (
				<ToastContent t={t} title={title} message={message} />
			));
		},
		onSuccess: () => {
			if (displaySuccessToast) {
				toast.success((t) => (
					<ToastContent
						t={t}
						title="Success"
						message="Settings updated successfully!"
					/>
				));
			}

			onReset?.();

			queryClient.invalidateQueries({ queryKey });
			if (navigateTo) {
				// navigate({ to: navigateTo });
				setTimeout(() => {
					navigate({ to: navigateTo });
				}, 0);
			}
		},
	});
}
