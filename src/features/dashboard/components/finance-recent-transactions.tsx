"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getRecentTransactions } from "@/features/dashboard/services/finance.api";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { cn } from "@/lib/utils";

export function FinanceRecentTransactions() {
	const { data } = useSuspenseQuery({
		queryKey: [...dashboardQueries.all, "recent-transactions"],
		queryFn: () => getRecentTransactions(),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Transactions</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Date</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Entity</TableHead>
							<TableHead>Reference</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Amount</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.map((transaction, index) => (
							<TableRow key={`${transaction.reference}-${index}`}>
								<TableCell>
									{format(new Date(transaction.date), "MMM dd, yyyy")}
								</TableCell>
								<TableCell>
									<Badge
										variant={
											transaction.type === "income" ? "default" : "secondary"
										}
										className={cn(
											transaction.type === "income"
												? "bg-emerald-500 hover:bg-emerald-600"
												: "",
										)}
									>
										{transaction.type}
									</Badge>
								</TableCell>
								<TableCell>{transaction.entity}</TableCell>
								<TableCell className="font-mono text-xs text-muted-foreground">
									{transaction.reference}
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="capitalize">
										{transaction.status}
									</Badge>
								</TableCell>
								<TableCell
									className={cn(
										"text-right font-medium",
										transaction.type === "income"
											? "text-emerald-600"
											: "text-red-600",
									)}
								>
									{transaction.type === "income" ? "+" : "-"}
									{transaction.amount.toLocaleString()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
