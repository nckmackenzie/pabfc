import { PDFDownloadLink } from "@react-pdf/renderer";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { DownloadIcon } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { WhtSchedulePdf } from "@/features/reports/components/downloadable-wht-schedule";
import {
	summariseWhtSchedule,
	type WhtScheduleRow,
} from "@/features/reports/lib/wht-schedule";
import type { WhtScheduleFormSchema } from "@/features/reports/services/schema";
import { getWhtSchedule } from "@/features/reports/services/wht-schedule.api";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter, dateFormat } from "@/lib/helpers";
import { toTitleCase } from "@/lib/utils";

const route = getRouteApi("/app/reports/finance/wht-schedule/");
const COLUMN_COUNT = 8;

/**
 * The period's withholding deductions, grouped by nature of expense so the totals
 * line up with the categories on the KRA return.
 */
export function WhtScheduleReport() {
	const { filters } = useFilters(route.id);

	const { data } = useSuspenseQuery({
		queryKey: ["reports", "wht-schedule", filters],
		queryFn: () => getWhtSchedule({ data: filters as WhtScheduleFormSchema }),
		staleTime: 0,
	});

	const summary = summariseWhtSchedule(data as Array<WhtScheduleRow>);

	if (summary.groups.length === 0) {
		return (
			<EmptyState
				title="No withholding tax in this period"
				description="No bill in the selected date range had withholding tax deducted."
			/>
		);
	}

	const period =
		filters.dateRange?.from && filters.dateRange?.to
			? `${dateFormat(filters.dateRange.from, "long")} to ${dateFormat(
					filters.dateRange.to,
					"long",
				)}`
			: "";

	return (
		<div className="space-y-4">
			<div className="flex justify-end no-print">
				<Button asChild variant="outline" size="sm">
					<PDFDownloadLink
						document={
							<WhtSchedulePdf
								data={{
									period,
									groups: summary.groups.map((group) => ({
										label: group.label,
										rows: group.rows.map((row) => ({
											vendor: toTitleCase(row.vendor),
											taxPin: row.taxPin?.toUpperCase() ?? "-",
											invoiceNo: row.invoiceNo,
											invoiceDate: dateFormat(row.invoiceDate, "reporting"),
											grossAmount: currencyFormatter(row.grossAmount, false),
											rate: row.rate ?? "-",
											whtAmount: currencyFormatter(row.whtAmount, false),
											certificateNo: row.certificateNo?.toUpperCase() ?? "-",
										})),
										grossAmount: currencyFormatter(group.grossAmount, false),
										whtAmount: currencyFormatter(group.whtAmount, false),
									})),
									totalGrossAmount: currencyFormatter(summary.grossAmount, false),
									totalWhtAmount: currencyFormatter(summary.whtAmount, false),
								}}
							/>
						}
						fileName="WHT-Schedule.pdf"
						key={Date.now()}
					>
						{({ loading }) =>
							loading ? (
								"Generating PDF..."
							) : (
								<>
									<DownloadIcon className="h-4 w-4" />
									Export PDF
								</>
							)
						}
					</PDFDownloadLink>
				</Button>
			</div>
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[200px]">Vendor</TableHead>
							<TableHead className="w-[140px]">PIN</TableHead>
							<TableHead className="w-[140px]">Bill Ref</TableHead>
							<TableHead className="w-[130px]">Bill Date</TableHead>
							<TableHead className="text-right w-[160px]">
								Gross Amount (excl. VAT)
							</TableHead>
							<TableHead className="text-right w-[90px]">Rate %</TableHead>
							<TableHead className="text-right w-[150px]">WHT Amount</TableHead>
							<TableHead className="w-[150px]">Certificate No</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{summary.groups.map((group) => (
							<Fragment key={group.label}>
								<TableRow className="bg-muted/50">
									<TableCell colSpan={COLUMN_COUNT} className="font-semibold">
										Withheld at {group.label}
									</TableCell>
								</TableRow>
								{group.rows.map((row, index) => (
									<TableRow
										key={`${group.label}-${row.invoiceNo}-${index.toString()}`}
									>
										<TableCell>{toTitleCase(row.vendor)}</TableCell>
										<TableCell>{row.taxPin?.toUpperCase() ?? "-"}</TableCell>
										<TableCell>{row.invoiceNo}</TableCell>
										<TableCell>
											{dateFormat(row.invoiceDate, "reporting")}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(row.grossAmount, false)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{row.rate ?? "-"}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{currencyFormatter(row.whtAmount, false)}
										</TableCell>
										<TableCell>
											{row.certificateNo?.toUpperCase() ?? "-"}
										</TableCell>
									</TableRow>
								))}
								<TableRow>
									<TableCell colSpan={4} className="text-right font-medium">
										Subtotal at {group.label}
									</TableCell>
									<TableCell className="text-right font-medium tabular-nums">
										{currencyFormatter(group.grossAmount, false)}
									</TableCell>
									<TableCell />
									<TableCell className="text-right font-medium tabular-nums">
										{currencyFormatter(group.whtAmount, false)}
									</TableCell>
									<TableCell />
								</TableRow>
							</Fragment>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell colSpan={4} className="text-right font-bold">
								Total
							</TableCell>
							<TableCell className="text-right font-bold tabular-nums">
								{currencyFormatter(summary.grossAmount, false)}
							</TableCell>
							<TableCell />
							<TableCell className="text-right font-bold tabular-nums">
								{currencyFormatter(summary.whtAmount, false)}
							</TableCell>
							<TableCell />
						</TableRow>
					</TableFooter>
				</Table>
			</div>
		</div>
	);
}
