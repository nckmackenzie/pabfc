/** biome-ignore-all lint/suspicious/noArrayIndexKey: <> */
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Wrapper } from "@/components/ui/wrapper";

interface TableSkeletonProps {
	rowCount: number;
	columnWidths: Array<string>;
}

export function TableSkeleton({ rowCount, columnWidths }: TableSkeletonProps) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					{columnWidths.map((_, index) => (
						<TableHead key={`th-${index}`}>
							<Skeleton
								className={`h-4 ${columnWidths[index]}`}
								aria-hidden="true"
							/>
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{Array.from({ length: rowCount }).map((_, rowIndex) => (
					<TableRow key={`row-${rowIndex}`}>
						{columnWidths.map((width, colIndex) => (
							<TableCell key={`row-${rowIndex}-col-${colIndex}`}>
								<Skeleton className={`h-4 ${width}`} aria-hidden="true" />
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export function AuthedPageLoader() {
	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<div className="space-y-0.5">
					<Skeleton className="h-6 w-44" />
					<Skeleton className="h-4 w-72" />
				</div>
			</div>
			<Skeleton className="h-10 w-72" />
			<TableSkeleton
				rowCount={10}
				columnWidths={["w-36", "w-24", "w-56", "w-44", "w-24", "w-1"]}
			/>
		</div>
	);
}

export function FormLoader() {
	return (
		<Wrapper size="full">
			<Skeleton className="h-10 w-72" />
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		</Wrapper>
	);
}

export function DatatableSkeleton() {
	return (
		<TableSkeleton
			rowCount={10}
			columnWidths={["w-36", "w-24", "w-56", "w-44", "w-24", "w-1"]}
		/>
	);
}

export function PageLoader({ loaderMessage }: { loaderMessage?: string }) {
	return (
		<div className="flex items-center justify-center h-[calc(100vh-4rem)]">
			<div className="flex flex-col items-center gap-4">
				<Spinner className="size-12 text-primary" />
				<p className="text-muted-foreground text-sm">
					{loaderMessage || "Loading, please wait..."}
				</p>
			</div>
		</div>
	);
}
