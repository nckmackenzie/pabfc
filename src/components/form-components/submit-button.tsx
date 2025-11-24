import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { useFormContext } from "@/lib/form";
import { Field } from "../ui/field";

type SubmitButtonProps = {
	buttonText: string;
	disabled?: boolean;
	isLoading?: boolean;
	orientation?: "horizontal" | "vertical" | "responsive";
	withReset?: boolean;
};

export function SubmitButton({
	buttonText,
	disabled,
	isLoading,
	orientation,
	withReset = false,
}: SubmitButtonProps & ComponentProps<"button">) {
	const form = useFormContext();
	return (
		<form.Subscribe selector={(state) => [state.isSubmitting]}>
			{([isSubmitting]) => (
				<Field orientation={orientation || "responsive"}>
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
							onClick={() => form.reset()}
						>
							Cancel
						</Button>
					)}
				</Field>
			)}
		</form.Subscribe>
	);
}
