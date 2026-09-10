import { useQuery } from "@tanstack/react-query";
import { ArrowUpWideNarrowIcon } from "lucide-react";
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

export function OverdueBillsSheet() {
	const {
		data: overdueBills,
		isError,
		isLoading,
	} = useQuery(dashboardQueries.overdueBillsBreakdown());

	if (isLoading) {
		return (
			<div className="p-4">
				<TableSkeleton
					rowCount={5}
					columnWidths={["w-36", "w-28", "w-24", "w-24"]}
				/>
			</div>
		);
	}

	if (isError) {
		return (
			<EmptyState
				icon={<ArrowUpWideNarrowIcon />}
				title="Unable to load overdue bills"
				description="Close the sheet and try again."
			/>
		);
	}

	if (!overdueBills?.length) {
		return (
			<EmptyState
				icon={<ArrowUpWideNarrowIcon />}
				title="No overdue bills"
				description="Every bill past its due date has been settled."
			/>
		);
	}

	const total = overdueBills.reduce((sum, bill) => sum + bill.balance, 0);

	return (
		<div className="p-4">
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Vendor</TableHead>
							<TableHead>Invoice</TableHead>
							<TableHead>Due</TableHead>
							<TableHead className="text-right">Balance</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{overdueBills.map((bill) => (
							<TableRow key={bill.id}>
								<TableCell className="font-medium capitalize">
									{bill.vendor}
								</TableCell>
								<TableCell>
									<span className="block">{bill.invoiceNo}</span>
									<span className="block text-xs text-muted-foreground">
										{currencyFormatter(bill.total, false)} billed
									</span>
								</TableCell>
								<TableCell className="whitespace-nowrap">
									<span className="block">
										{bill.dueDate ? dateFormat(bill.dueDate, "reporting") : "—"}
									</span>
									<span className="block text-xs text-muted-foreground">
										{bill.daysOverdue} day{bill.daysOverdue === 1 ? "" : "s"}{" "}
										overdue
									</span>
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{currencyFormatter(bill.balance, false)}
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
