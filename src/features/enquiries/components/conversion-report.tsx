import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { format, parse } from "date-fns";
import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { DataTable } from "@/components/ui/datatable";
import { EmptyState } from "@/components/ui/empty";
import { PhoneIcon } from "@/components/ui/icons";
import {
	type ConversionGroupRow,
	type EnquiryConversionReport as EnquiryConversionReportData,
	formatDays,
	formatRate,
} from "@/features/enquiries/lib/enquiry-report";
import { enquiryQueries } from "@/features/enquiries/services/queries";
import type { EnquiryConversionFormSchema } from "@/features/enquiries/services/schemas";
import { useFilters } from "@/hooks/use-filters";
import { currencyFormatter } from "@/lib/helpers";

const trendConfig = {
	created: { label: "Enquiries created", color: "var(--chart-1)" },
	conversions: { label: "Conversions recorded", color: "var(--chart-2)" },
} satisfies ChartConfig;

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
	return (
		<Card className="shadow-none">
			<CardHeader className="pb-1">
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-2xl font-mono">{value}</CardTitle>
			</CardHeader>
			{hint && (
				<CardContent>
					<p className="text-xs text-muted-foreground">{hint}</p>
				</CardContent>
			)}
		</Card>
	);
}

function Section({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-3">
			<div className="space-y-0.5">
				<h2 className="text-lg font-semibold font-display">{title}</h2>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}

// Strings in, strings out: the export to Excel uses the same values as the screen.
function groupColumns(firstHeader: string): Array<ColumnDef<ConversionGroupRow>> {
	return [
		{ id: "label", header: firstHeader, accessorFn: (row) => row.label },
		{ id: "enquiries", header: "Enquiries", accessorFn: (row) => row.enquiries },
		{ id: "converted", header: "Converted", accessorFn: (row) => row.converted },
		{ id: "registered", header: "Awaiting payment", accessorFn: (row) => row.registered },
		{ id: "lost", header: "Lost", accessorFn: (row) => row.lost },
		{ id: "open", header: "Open", accessorFn: (row) => row.open },
		{ id: "rate", header: "Conversion rate", accessorFn: (row) => formatRate(row.conversionRate) },
		{
			id: "days",
			header: "Avg days to convert",
			accessorFn: (row) => formatDays(row.averageDaysToConvert),
		},
		{
			id: "revenue",
			header: "First-payment revenue",
			accessorFn: (row) => currencyFormatter(row.firstPaymentRevenue),
		},
	];
}

const sourceColumns = groupColumns("Source");
const staffColumns = groupColumns("Assigned staff");

const lostReasonColumns: Array<ColumnDef<EnquiryConversionReportData["lostReasons"][number]>> = [
	{ id: "reason", header: "Reason", accessorFn: (row) => row.label },
	{ id: "count", header: "Lost", accessorFn: (row) => row.count },
	{ id: "share", header: "% of lost", accessorFn: (row) => formatRate(row.share) },
];

function monthLabel(month: string) {
	return format(parse(`${month}-01`, "yyyy-MM-dd", new Date()), "MMM yyyy");
}

function CohortKpis({ cohort }: { cohort: EnquiryConversionReportData["cohort"] }) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<Kpi label="Enquiries" value={cohort.total} />
			<Kpi label="Converted so far" value={cohort.converted} />
			<Kpi
				label="Conversion rate"
				value={formatRate(cohort.conversionRate)}
				hint="Converted ÷ enquiries"
			/>
			<Kpi
				label="Awaiting first payment"
				value={cohort.registered}
				hint="Registered, not yet paid"
			/>
			<Kpi label="Lost" value={cohort.lost} />
			<Kpi label="Still open" value={cohort.open} hint="New or contacted" />
			<Kpi
				label="Avg days to convert"
				value={formatDays(cohort.averageDaysToConvert)}
				hint="Converted enquiries only"
			/>
			<Kpi label="Median days to convert" value={formatDays(cohort.medianDaysToConvert)} />
			<Kpi
				label="Direct registrations"
				value={cohort.directRegistrations}
				hint="Converted without using Convert/Link (matched by phone)"
			/>
		</div>
	);
}

export function EnquiryConversionReport() {
	const { filters } = useFilters(getRouteApi("/app/reports/enquiries/conversion/").id);
	const { data } = useSuspenseQuery(
		enquiryQueries.conversionReport(filters as EnquiryConversionFormSchema)
	);
	const { cohort, activity } = data;

	if (cohort.total === 0 && activity.conversions === 0) {
		return (
			<EmptyState
				icon={<PhoneIcon />}
				title="No enquiries in this period"
				description="Nothing was logged or converted between these dates with these filters."
			/>
		);
	}

	return (
		<div className="space-y-10">
			<Section
				title="Enquiries created in this period"
				description="Follows the enquiries logged between these dates and shows where each one stands today."
			>
				<CohortKpis cohort={cohort} />
			</Section>

			<Section
				title="Conversions recorded in this period"
				description="Counted on the date of the converting payment, whenever the enquiry was logged. Revenue is the total of those payments (including VAT and add-ons), shared evenly if one payment converted several enquiries."
			>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<Kpi label="Conversions" value={activity.conversions} />
					<Kpi
						label="First-payment revenue"
						value={currencyFormatter(activity.firstPaymentRevenue)}
					/>
					<Kpi
						label="Direct registrations"
						value={activity.directRegistrations}
						hint="Matched by phone, not Convert/Link"
					/>
				</div>
			</Section>

			<Section
				title="Trend"
				description="Enquiries created versus conversions recorded in each month. These are the two measures above, so the bars are not one funnel."
			>
				<Card className="shadow-none">
					<CardContent className="pt-6">
						<ChartContainer config={trendConfig} className="aspect-auto h-72 w-full">
							<BarChart
								accessibilityLayer
								data={data.monthlyTrend.map((point) => ({
									...point,
									month: monthLabel(point.month),
								}))}
							>
								<CartesianGrid vertical={false} />
								<XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
								<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
								<ChartTooltip content={<ChartTooltipContent />} />
								<ChartLegend content={<ChartLegendContent />} />
								<Bar dataKey="created" fill="var(--color-created)" radius={4} />
								<Bar dataKey="conversions" fill="var(--color-conversions)" radius={4} />
							</BarChart>
						</ChartContainer>
					</CardContent>
				</Card>
			</Section>

			<Section
				title="By source"
				description="Enquiries created in the period, grouped by where they came from."
			>
				<DataTable
					columns={sourceColumns}
					data={data.bySource}
					exportToExcel
					exportFileName="enquiry-conversion-by-source.csv"
				/>
			</Section>

			<Section
				title="By assigned staff"
				description="Enquiries created in the period, grouped by who they were assigned to."
			>
				<DataTable
					columns={staffColumns}
					data={data.byStaff}
					exportToExcel
					exportFileName="enquiry-conversion-by-staff.csv"
				/>
			</Section>

			<Section title="Lost reasons" description="Why enquiries created in the period were lost.">
				{data.lostReasons.length === 0 ? (
					<p className="text-sm text-muted-foreground">No lost enquiries in this period.</p>
				) : (
					<DataTable
						columns={lostReasonColumns}
						data={data.lostReasons}
						exportToExcel
						exportFileName="enquiry-lost-reasons.csv"
					/>
				)}
			</Section>
		</div>
	);
}
