import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Route } from "@/types/index.types";
import type { buttonVariants } from "./button";
import { BackLink } from "./links";
import { Wrapper } from "./wrapper";

type EditPageWrapperProps = {
	backPath: Route;
	buttonText?: string;
	className?: string;
	variant?: VariantProps<typeof buttonVariants>["variant"];
	size?: VariantProps<typeof buttonVariants>["size"];
	wrapperSize?: VariantProps<typeof Wrapper>["size"];
	children: React.ReactNode;
};

export function EditPageWrapper(props: EditPageWrapperProps) {
	return (
		<div className="space-y-6">
			<BackLink size={props.size} variant={props.variant} href={props.backPath}>
				{props.buttonText || "Bak to List"}
			</BackLink>
			<Wrapper
				size={props.wrapperSize}
				className={cn("space-y-6", props.className)}
			>
				{props.children}
			</Wrapper>
		</div>
	);
}

export function PageWrapperWithBackLink(props: EditPageWrapperProps) {
	return (
		<div className="space-y-8">
			<BackLink size="sm" variant="outline" href={props.backPath}>
				{props.buttonText || "Bak to List"}
			</BackLink>
			<Wrapper size={props.wrapperSize}>{props.children}</Wrapper>
		</div>
	);
}
