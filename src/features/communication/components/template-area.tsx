import { useSuspenseQuery } from "@tanstack/react-query";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import CustomModal from "@/components/ui/custom-modal";
import { ErrorBoundaryWithSuspense } from "@/components/ui/error-boundary-with-suspense";
import { PlusIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";
import type { smsTemplates } from "@/drizzle/schema";
import { TemplateForm } from "@/features/communication/components/template-form";
import { smsTemplateQueries } from "@/features/communication/services/queries";
import { useModal } from "@/integrations/modal-provider";
import { toTitleCase } from "@/lib/utils";

export function TemplateArea() {
	const { setOpen } = useModal();
	return (
		<Wrapper>
			<header className="flex items-center justify-between">
				<div className="space-y-0.5">
					<h2 className="text-lg font-semibold font-display">Templates</h2>
					<p className="text-muted-foreground text-xs">Manage your templates</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						setOpen(
							<CustomModal title="New Template">
								<TemplateForm />
							</CustomModal>,
						)
					}
				>
					<PlusIcon />
					New Template
				</Button>
			</header>
			<ErrorBoundaryWithSuspense
				errorMessage="Failed to load templates"
				loader={<TemplatesSkeleton />}
			>
				<Templates />
			</ErrorBoundaryWithSuspense>
		</Wrapper>
	);
}

function Templates() {
	const { data } = useSuspenseQuery(smsTemplateQueries.list());
	return (
		<ul className="-mx-2">
			{data?.map((template) => (
				<Template key={template.id} template={template} />
			))}
		</ul>
	);
}

function Template({
	template,
}: {
	template: Omit<
		typeof smsTemplates.$inferSelect,
		"createdAt" | "updatedAt"
	> & { usedCount: number };
}) {
	const { setOpen } = useModal();
	const { description, name, usedCount } = template;

	function handleClick() {
		setOpen(
			<CustomModal title="New Template">
				<TemplateForm
					template={{
						content: template.content,
						description: template.description as string,
						name: toTitleCase(template.name.toLocaleLowerCase()),
						id: template.id,
					}}
				/>
			</CustomModal>,
		);
	}

	function handleKeyPress(e: KeyboardEvent<HTMLLIElement>) {
		if (e.key === "Enter") {
			handleClick();
		}
	}
	return (
		<li
			onClick={handleClick}
			className="p-2 transition-colors rounded-md hover:bg-accent cursor-pointer"
			onKeyUp={handleKeyPress}
		>
			<div className="flex items-center justify-between">
				<h3 className="text-base font-semibold font-display capitalize">
					{name.toLowerCase()}
				</h3>
				<p className="text-muted-foreground text-xs">
					{`${usedCount === 0 ? "Never used" : usedCount === 1 ? "Used once" : `Used ${usedCount} times`}`}
				</p>
			</div>
			<p className="text-muted-foreground text-xs">
				{description
					? description.charAt(0).toUpperCase() + description.slice(1)
					: "No description"}
			</p>
		</li>
	);
}

function TemplatesSkeleton() {
	return (
		<ul className="-mx-2 space-y-2">
			{Array.from({ length: 5 }).map((_, i) => (
				<TemplateSkeleton key={i.toString()} />
			))}
		</ul>
	);
}

function TemplateSkeleton() {
	return (
		<li className="p-2 rounded-md">
			<div className="flex items-center justify-between mb-2">
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-4 w-20" />
			</div>
			<Skeleton className="h-4 w-full" />
		</li>
	);
}
