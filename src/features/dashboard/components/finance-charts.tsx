"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Label, Pie, PieChart, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	getFinanceChartData,
	getPlanDistribution,
} from "@/features/dashboard/services/finance.api";
import {
	buildPlanDistribution,
	withSharePercentage,
} from "@/features/dashboard/lib/plan-distribution";
import { dashboardQueries } from "@/features/dashboard/services/queries";
import { currencyFormatter } from "@/lib/helpers";

const areaChartConfig = {
	revenue: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
	expenses: {
		label: "Expenses",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function FinanceAreaChart() {
	const { data } = useSuspenseQuery({
		queryKey: [...dashboardQueries.all, "finance-chart-data"],
		queryFn: () => getFinanceChartData(),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Revenue vs Expenses</CardTitle>
				<CardDescription>Showing revenue and expenses month to date</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={areaChartConfig}>
					<AreaChart
						accessibilityLayer
						data={data}
						margin={{
							left: 12,
							right: 12,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							// tickFormatter={(value) => value.slice(0, 3)}
						/>
						<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
						<Area
							dataKey="expenses"
							type="monotone"
							fill="var(--color-expenses)"
							fillOpacity={0.4}
							stroke="var(--color-expenses)"
							stackId="a"
						/>
						<Area
							dataKey="revenue"
							type="monotone"
							fill="var(--color-revenue)"
							fillOpacity={0.4}
							stroke="var(--color-revenue)"
							stackId="a"
						/>
						<ChartLegend content={<ChartLegendContent />} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

// --- Pie Chart ---

// The legend is plain HTML below the chart rather than a Recharts <Legend>:
// a legend inside the chart takes its height out of the drawing area, and with
// many plans the wrapped legend squeezed the pie's outer radius below its inner
// radius, so the ring vanished while the centre label still rendered.
const pieChartConfig = {
	value: {
		label: "Revenue",
	},
} satisfies ChartConfig;

export function FinancePieChart() {
	const { data } = useSuspenseQuery({
		queryKey: [...dashboardQueries.all, "plan-distribution"],
		queryFn: () => getPlanDistribution(),
	});

	const slices = useMemo(() => withSharePercentage(buildPlanDistribution(data)), [data]);
	const totalRevenue = slices.reduce((acc, curr) => acc + curr.value, 0);

	return (
		<Card className="flex flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>Plan Distribution</CardTitle>
				<CardDescription>Month-to-date revenue share by plan</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 space-y-4 pb-0">
				<ChartContainer config={pieChartConfig} className="mx-auto aspect-square h-60">
					<PieChart>
						<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
						<Pie
							data={slices}
							dataKey="value"
							nameKey="name"
							innerRadius="60%"
							outerRadius="90%"
							strokeWidth={5}
						>
							<Label
								content={({ viewBox }) => {
									if (viewBox && "cx" in viewBox && "cy" in viewBox) {
										return (
											<text
												x={viewBox.cx}
												y={viewBox.cy}
												textAnchor="middle"
												dominantBaseline="middle"
											>
												<tspan
													x={viewBox.cx}
													y={viewBox.cy}
													className="fill-foreground text-3xl font-bold"
												>
													{totalRevenue.toLocaleString()}
												</tspan>
												<tspan
													x={viewBox.cx}
													y={(viewBox.cy || 0) + 24}
													className="fill-muted-foreground"
												>
													Revenue
												</tspan>
											</text>
										);
									}
								}}
							/>
						</Pie>
					</PieChart>
				</ChartContainer>
				<ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 pb-4 text-xs">
					{slices.map((slice) => (
						<li key={slice.name} className="flex items-center gap-2">
							<span
								className="size-2.5 shrink-0 rounded-[2px]"
								style={{ backgroundColor: slice.fill }}
							/>
							<span className="font-medium">{slice.name}</span>
							<span className="text-muted-foreground">
								{currencyFormatter(slice.value, false)} ({slice.percentage.toFixed(1)}%)
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
