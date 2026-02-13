import { cn } from "@/lib/utils";

type Props = {
	children: React.ReactNode;
	size?: "xs" | "sm" | "md" | "lg" | "full";
	className?: string;
};

export function Wrapper({ children, size = "md", className }: Props) {
	return (
		<div
			className={cn(
				"p-4 md:px-6 bg-popover mx-auto rounded-md md:shadow-sm space-y-6 w-full",
				{
					"max-w-xl": size === "xs",
					"max-w-3xl": size === "sm",
					"max-w-4xl": size === "md",
					"max-w-5xl": size === "lg",
					"max-w-7xl mx-0": size === "full",
				},
				className,
			)}
		>
			{children}
		</div>
	);
}
