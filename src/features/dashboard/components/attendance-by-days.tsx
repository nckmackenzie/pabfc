import { useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQueries } from "@/features/dashboard/services/queries";

export const description = "A horizontal bar chart";

const chartConfig = {
	attendance: {
		label: "Attendance",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

export function AverageAttendanceByDays() {
	const { data: chartData } = useSuspenseQuery(
		dashboardQueries.averageAttendanceByDay(),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Average Attendance</CardTitle>
			</CardHeader>
			<CardContent className="flex-1">
				<ChartContainer config={chartConfig} className="h-full w-full">
					<BarChart
						accessibilityLayer
						data={chartData}
						layout="vertical"
						margin={{
							left: -20,
						}}
					>
						<XAxis type="number" dataKey="attendance" hide />
						<YAxis
							dataKey="day"
							type="category"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
							tickFormatter={(value) => value.slice(0, 3)}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideLabel />}
						/>
						<Bar dataKey="attendance" fill="var(--color-chart-2)" radius={5} />
					</BarChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex-col items-start gap-2 text-sm">
				<div className="flex gap-2 leading-none font-medium">
					Showing average attendance
				</div>
				<div className="text-muted-foreground leading-none">
					By Day of Week (Last 30 Days)
				</div>
			</CardFooter>
		</Card>
	);
}

export function AverageAttendanceByDaysSkeleton() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Average Attendance</CardTitle>
			</CardHeader>
			<CardContent className="flex-1">
				<div className="space-y-6 py-4">
					{Array.from({ length: 7 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Skeleton items are static
							key={i}
							className="flex items-center gap-4"
						>
							<Skeleton className="h-4 w-8" />
							<Skeleton className="h-6 flex-1 rounded-lg" />
						</div>
					))}
				</div>
			</CardContent>
			<CardFooter className="flex-col items-start gap-2 text-sm">
				<div className="flex gap-2 leading-none font-medium">
					Showing average attendance
				</div>
				<div className="text-muted-foreground leading-none">
					By Day of Week (Last 30 Days)
				</div>
			</CardFooter>
		</Card>
	);
}
