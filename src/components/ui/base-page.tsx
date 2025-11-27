import { type PropsWithChildren, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AlertErrorComponent } from "@/components/ui/error-component";
import { PlusIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/links";
import { DatatableSkeleton } from "@/components/ui/loaders";
import { PageHeader } from "@/components/ui/page-header";
import { Search } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";
import type { Permission } from "@/lib/permissions/constants";
import { cn } from "@/lib/utils";
import type { Route } from "@/types/index.types";
import { PermissionGate } from "./permission-gate";

type BaseProps = {
	className?: string;
	size?: "xs" | "sm" | "md" | "lg" | "full";
	pageTitle: string;
	pageDescription?: string;
	searchPlaceholder?: string;
	extraActionButtons?: React.ReactNode;
	onSearch?: (value: string) => void;
	loadingComponent?: React.ReactNode;
	defaultSearchValue?: string;
	customFilters?: React.ReactNode;
	filterClassName?: string;
};

type PropsWithButton = BaseProps & {
	hasNewButtonLink: true;
	newButtonLinkPath: Route;
	buttonText?: string;
	buttonIcon?: React.ReactNode;
	createPermissions?: Array<Permission>;
};

type PropsWithoutButton = BaseProps & {
	hasNewButtonLink?: false;
	newButtonLinkPath?: never;
	buttonText?: never;
	buttonIcon?: never;
	createPermissions?: never;
};

type Props = PropsWithButton | PropsWithoutButton;

export function BasePageComponent({
	className,
	size = "full",
	pageTitle,
	pageDescription,
	hasNewButtonLink,
	newButtonLinkPath,
	searchPlaceholder = "Search...",
	extraActionButtons,
	onSearch,
	children,
	buttonIcon,
	buttonText = "Create New",
	loadingComponent,
	defaultSearchValue,
	customFilters,
	filterClassName,
	createPermissions,
}: PropsWithChildren<Props>) {
	return (
		<Wrapper className={cn("space-y-6", className)} size={size}>
			<PageHeader title={pageTitle} description={pageDescription} />
			<div
				className={cn(
					"flex flex-col gap-y-2 md:gap-y-0 md:flex-row md:items-center md:justify-between",
					filterClassName,
				)}
			>
				{onSearch && (
					<Search
						placeholder={searchPlaceholder}
						onHandleSearch={onSearch}
						defaultValue={defaultSearchValue}
					/>
				)}
				<div className="flex flex-col sm:flex-row sm:items-center gap-2">
					{hasNewButtonLink &&
						(!createPermissions ? (
							<ButtonLink
								path={newButtonLinkPath}
								variant="default"
								icon={buttonIcon ?? <PlusIcon />}
							>
								{buttonText}
							</ButtonLink>
						) : (
							<PermissionGate permissions={createPermissions}>
								<ButtonLink
									path={newButtonLinkPath}
									variant="default"
									icon={buttonIcon ?? <PlusIcon />}
								>
									{buttonText}
								</ButtonLink>
							</PermissionGate>
						))}
					{extraActionButtons}
				</div>
			</div>
			{customFilters}
			<Suspense>
				<ErrorBoundary
					fallbackRender={({ error }) => (
						<AlertErrorComponent message={error.message} />
					)}
				>
					<Suspense fallback={loadingComponent ?? <DatatableSkeleton />}>
						{children}
					</Suspense>
				</ErrorBoundary>
			</Suspense>
		</Wrapper>
	);
}

type BasePageLoadingSkeletonProps = {
	pageTitle?: string;
	pageDescription?: string;
};

export const BasePageLoadingSkeleton = ({
	pageDescription,
	pageTitle,
}: BasePageLoadingSkeletonProps) => {
	return (
		<Wrapper className="space-y-6" size="full">
			<PageHeader
				title={pageTitle ?? "Loading..."}
				description={pageDescription ?? "Please wait while loading"}
			/>
			<Skeleton className="h-10 max-w-sm" />
			<DatatableSkeleton />
		</Wrapper>
	);
};
