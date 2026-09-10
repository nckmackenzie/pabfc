import { useQuery } from "@tanstack/react-query";
import { BanknoteArrowDownIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/loaders";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

export function ExpenseMtdSheet() {
	const {
		data: expenseLines,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.expenseMtdBreakdown());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton
					rowCount={5}
					columnWidths={["w-24", "w-36", "w-32", "w-24"]}
				/>
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<BanknoteArrowDownIcon />}
				title="Unable to load expenses"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!expenseLines?.length) {
		return (
			<EmptyState
				icon={<BanknoteArrowDownIcon />}
				title="No expenses this month"
				description="Nothing has been posted to an expense account month to date."
			/>
		);
	}

	const total = expenseLines.reduce((sum, line) => sum + line.amount, 0);

	return (
		<div className="p-4">
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Date</TableHead>
							<TableHead>Account</TableHead>
							<TableHead>Details</TableHead>
							<TableHead className="text-right">Amount</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{expenseLines.map((line) => (
							<TableRow key={line.id}>
								<TableCell className="whitespace-nowrap">
									{dateFormat(line.date, "reporting")}
								</TableCell>
								<TableCell className="capitalize">{line.account}</TableCell>
								<TableCell>
									<span className="block capitalize">
										{line.entity ?? toTitleCase(line.source ?? "journal")}
									</span>
									{line.reference && (
										<span className="block text-xs text-muted-foreground">
											{line.reference}
										</span>
									)}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{currencyFormatter(line.amount, false)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell colSpan={3} className="font-medium">
								Total
							</TableCell>
							<TableCell className="text-right font-medium tabular-nums">
								{currencyFormatter(total, false)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</div>
		</div>
	);
}
