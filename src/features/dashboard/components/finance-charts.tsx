"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Label,
	Pie,
	PieChart,
	XAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { dashboardQueries } from "@/features/dashboard/services/queries";

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
				<CardDescription>
					Showing revenue and expenses for the last 30 days
				</CardDescription>
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
							tickFormatter={(value) => value.slice(0, 3)}
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

const pieChartConfig = {
	plans: {
		label: "Plans",
	},
	basic: {
		label: "Basic",
		color: "var(--chart-1)",
	},
	pro: {
		label: "Pro",
		color: "var(--chart-2)",
	},
	elite: {
		label: "Elite",
		color: "var(--chart-3)",
	},
	student: {
		label: "Student",
		color: "var(--chart-4)",
	},
} satisfies ChartConfig;

export function FinancePieChart() {
	const { data } = useSuspenseQuery({
		queryKey: [...dashboardQueries.all, "plan-distribution"],
		queryFn: () => getPlanDistribution(),
	});

	const totalRevenue = data.reduce((acc, curr) => acc + curr.value, 0);

	return (
		<Card className="flex flex-col">
			<CardHeader className="items-center pb-0">
				<CardTitle>Plan Distribution</CardTitle>
				<CardDescription>Revenue share by plan</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 pb-0">
				<ChartContainer
					config={pieChartConfig}
					className="mx-auto aspect-square max-h-[250px]"
				>
					<PieChart>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideLabel />}
						/>
						<Pie
							data={data}
							dataKey="value"
							nameKey="name"
							innerRadius={60}
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
			</CardContent>
		</Card>
	);
}
