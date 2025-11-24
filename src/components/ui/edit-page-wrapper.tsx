import type { VariantProps } from "class-variance-authority";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import type { Route } from "@/types/index.types";
import type { buttonVariants } from "./button";
import { BackLink } from "./links";

type EditPageWrapperProps = {
	backPath: Route;
	buttonText?: string;
	className?: string;
	variant?: VariantProps<typeof buttonVariants>["variant"];
	size?: VariantProps<typeof buttonVariants>["size"];
};

export function EditPageWrapper(
	props: EditPageWrapperProps & Required<PropsWithChildren>,
) {
	return (
		<div className={cn("space-y-6", props.className)}>
			<BackLink size={props.size} variant={props.variant} href={props.backPath}>
				{props.buttonText || "Bak to List"}
			</BackLink>
			{props.children}
		</div>
	);
}
