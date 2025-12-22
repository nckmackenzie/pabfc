import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Wrapper } from "@/components/ui/wrapper";
import { generateRandomId } from "@/lib/utils";

export function JournalLoadingSkeleton() {
	return (
		<Wrapper size="full">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
				<h1 className="text-2xl font-semibold font-display">Journal Entry</h1>
				<Skeleton className="w-24 h-6" />
			</div>
			<div className="grid md:grid-cols-2 gap-4">
				{Array.from({ length: 2 }).map((_, index) => (
					<div key={`${generateRandomId()}-${index}`} className="space-y-2">
						<Skeleton className="h-4 w-56" />
						<Skeleton className="h-10 w-full" />
					</div>
				))}
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[300px]">Account</TableHead>
						<TableHead className="w-[180px]">Debit</TableHead>
						<TableHead className="w-[180px]">Credit</TableHead>
						<TableHead>Description</TableHead>
						<TableHead className="w-24"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 2 }).map((_, index) => (
						<TableRow key={`${generateRandomId()}-${index}`}>
							<TableCell>
								<Skeleton className="h-10 w-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-10 w-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-10 w-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-10 w-full" />
							</TableCell>
							<TableCell>
								<Skeleton className="h-10 w-4" />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
				<TableFooter>
					<TableRow>
						<TableCell className="text-right font-bold">Total</TableCell>
						<TableCell className="text-right font-bold">
							<Skeleton className="h-6 w-4" />
						</TableCell>
						<TableCell className="text-right font-bold">
							<Skeleton className="h-6 w-4" />
						</TableCell>
						<TableCell></TableCell>
					</TableRow>
				</TableFooter>
			</Table>
		</Wrapper>
	);
}
