import { Skeleton } from "@/components/ui/skeleton";
import { Wrapper } from "@/components/ui/wrapper";
import { generateRandomId } from "@/lib/utils";

export function MemberProfileSkeleton() {
	return (
		<Wrapper size="full" className="space-y-6">
			<div className="bg-background border border-gray-200 p-4 rounded-md flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div className="flex items-center gap-2">
					<Skeleton className="size-12 rounded-full" />
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-5 w-20 rounded-full" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-40 hidden md:inline-block" />
						</div>
					</div>
				</div>
				<div className="flex flex-col md:flex-row gap-2">
					<Skeleton className="h-10 w-28" />
					<Skeleton className="h-10 w-20" />
				</div>
			</div>
			<div className="grid md:grid-cols-2 gap-4">
				<div className="rounded-md border border-gray-200 p-4">
					<div className="space-y-4">
						<Skeleton className="h-6 w-32" />
						<div className="grid grid-cols-2 gap-x-8 gap-y-4 md:gap-x-12">
							{Array.from({ length: 10 }).map((_, i) => (
								<MemberInfoSkeleton
									key={generateRandomId(`skeleton-${i}`)}
									className={i === 9 ? "col-span-2" : ""}
								/>
							))}
						</div>
					</div>
				</div>
				<div className="grid gap-4">
					<div className="rounded-md border border-gray-200 p-4 h-40">
						<Skeleton className="h-6 w-40 mb-4" />
						<div className="flex flex-col items-center justify-center h-24">
							<Skeleton className="size-12 rounded-full mb-2" />
							<Skeleton className="h-4 w-48" />
						</div>
					</div>
					<div className="rounded-md border border-gray-200 p-4 h-40">
						<Skeleton className="h-6 w-40 mb-4" />
						<div className="flex flex-col items-center justify-center h-24">
							<Skeleton className="size-12 rounded-full mb-2" />
							<Skeleton className="h-4 w-48" />
						</div>
					</div>
				</div>
			</div>
		</Wrapper>
	);
}

function MemberInfoSkeleton({ className }: { className?: string }) {
	return (
		<div className={`grid gap-1 ${className}`}>
			<Skeleton className="h-3 w-16" />
			<Skeleton className="h-4 w-24" />
		</div>
	);
}
