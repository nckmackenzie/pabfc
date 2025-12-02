import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { CheckIcon } from "@/components/ui/icons";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFormContext } from "@/lib/form";

type SubmitButtonProps = {
	buttonText: string;
	disabled?: boolean;
	isLoading?: boolean;
	orientation?: "horizontal" | "vertical" | "responsive";
	withReset?: boolean;
	onReset?: () => void;
};

export function SubmitButton({
	buttonText,
	disabled,
	isLoading,
	orientation,
	withReset = true,
	onReset,
}: SubmitButtonProps & ComponentProps<"button">) {
	const form = useFormContext();
	const isMobile = useIsMobile();
	return (
		<form.Subscribe selector={(state) => [state.isSubmitting]}>
			{([isSubmitting]) => (
				<Field
					orientation={isMobile ? "vertical" : orientation || "horizontal"}
				>
					<Button
						type="submit"
						className="flex"
						disabled={isSubmitting || disabled || isLoading}
					>
						<LoadingSwap isLoading={isSubmitting || !!isLoading}>
							<CheckIcon />
							{buttonText}
						</LoadingSwap>
					</Button>
					{withReset && (
						<Button
							type="button"
							disabled={isSubmitting}
							variant="outline"
							onClick={onReset ? () => onReset() : () => form.reset()}
						>
							Cancel
						</Button>
					)}
				</Field>
			)}
		</form.Subscribe>
	);
}
