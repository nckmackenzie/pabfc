import { useBlocker } from "@tanstack/react-router";

/**
 * Prevents navigation if the provided TanStack Form is dirty.
 * Uses the native browser confirm dialog.
 */
export function usePreventUnsavedChanges(
	isDirty: boolean,
	message: string = "You have unsaved changes. Are you sure you want to leave?",
) {
	useBlocker({
		shouldBlockFn: () => {
			if (!isDirty) return false;

			const shouldLeave = window.confirm(message);
			return !shouldLeave;
		},
		enableBeforeUnload: () => isDirty,
	});
}
