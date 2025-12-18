import { useQuery } from "@tanstack/react-query";
import { NotepadTextIcon } from "lucide-react";
import { TableSkeleton } from "@/components/ui/loaders";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
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
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { expenseQueries } from "../services/queries";

export function ExpenseJournal({ expenseId }: { expenseId: string }) {
	const { data: journals, isLoading } = useQuery(
		expenseQueries.journal(expenseId),
	);
	const totalDebit = journals?.reduce(
		(total, journal) =>
			total + (journal.dc === "debit" ? parseFloat(journal.amount) : 0),
		0,
	);
	const totalCredit = journals?.reduce(
		(total, journal) =>
			total + (journal.dc === "credit" ? parseFloat(journal.amount) : 0),
		0,
	);
	return (
		<Sheet>
			<SheetTrigger asChild>
				<div className="drop-item">
					<NotepadTextIcon className="size-4! text-muted-foreground" />
					<span className="text-xs -ml-1">Transaction Journal</span>
				</div>
			</SheetTrigger>
			<SheetContent className="h-[calc(100vh-10rem)] " side="bottom">
				<div className="max-w-7xl mx-auto w-full p-4">
					{isLoading ? (
						<LoadingJournal />
					) : (
						<>
							<SheetHeader className="pl-0 ">
								<SheetTitle className="text-2xl font-semibold font-display">
									Transaction Journal
								</SheetTitle>
								<SheetDescription>
									Transaction journals for expense {journals?.[0]?.reference}
								</SheetDescription>
							</SheetHeader>
							<div className="rounded-md border overflow-x-auto bg-card">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="w-[100px]">Date</TableHead>
											<TableHead>Description</TableHead>
											<TableHead>Account</TableHead>
											<TableHead className="text-right">Debit</TableHead>
											<TableHead className="text-right">Credit</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{journals?.map((journal) => (
											<TableRow key={journal.id}>
												<TableCell className="font-medium">
													{dateFormat(journal.date, "reporting")}
												</TableCell>
												<TableCell>{journal.memo}</TableCell>
												<TableCell className="capitalize">
													{journal.account}
												</TableCell>
												<TableCell className="text-right">
													{journal.dc === "debit"
														? currencyFormatter(journal.amount, false)
														: ""}
												</TableCell>
												<TableCell className="text-right">
													{journal.dc === "credit"
														? currencyFormatter(journal.amount, false)
														: ""}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
									<TableFooter>
										<TableRow>
											<TableCell colSpan={3}>Total</TableCell>
											<TableCell className="text-right">
												{currencyFormatter(totalDebit ?? 0, false)}
											</TableCell>
											<TableCell className="text-right">
												{currencyFormatter(totalCredit ?? 0, false)}
											</TableCell>
										</TableRow>
									</TableFooter>
								</Table>
							</div>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function LoadingJournal() {
	return (
		<>
			<SheetHeader className="pl-0 ">
				<div className="space-y-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton className="h-4 w-64" />
				</div>
			</SheetHeader>
			<div className="py-8">
				<TableSkeleton
					rowCount={5}
					columnWidths={[
						"w-[100px]",
						"w-full",
						"w-[150px]",
						"w-[100px]",
						"w-[100px]",
					]}
				/>
			</div>
		</>
	);
}
