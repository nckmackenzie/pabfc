// The first five entries are the theme's own chart variables; the rest are fixed
// colours so a plan list longer than the theme defines still gets a distinct
// slice instead of an undefined `var(--chart-N)` (which paints nothing).
export const PLAN_DISTRIBUTION_PALETTE = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"oklch(0.65 0.17 150)",
	"oklch(0.6 0.2 25)",
	"oklch(0.7 0.13 220)",
	"oklch(0.55 0.15 330)",
	"oklch(0.72 0.14 110)",
] as const;

export type PlanDistributionSlice = { name: string; value: number; fill: string };

export function planDistributionColor(index: number) {
	return PLAN_DISTRIBUTION_PALETTE[index % PLAN_DISTRIBUTION_PALETTE.length];
}

/**
 * Drops plans with no revenue and assigns each remaining plan a colour from the
 * cycling palette, largest first. Zero-revenue plans would otherwise add
 * invisible slices and legend rows.
 */
export function buildPlanDistribution(rows: { name: string; value: number }[]): PlanDistributionSlice[] {
	return rows
		.filter((row) => row.value > 0)
		.sort((a, b) => b.value - a.value)
		.map((row, index) => ({ ...row, fill: planDistributionColor(index) }));
}

export function withSharePercentage(slices: PlanDistributionSlice[]) {
	const total = slices.reduce((sum, slice) => sum + slice.value, 0);
	return slices.map((slice) => ({
		...slice,
		percentage: total > 0 ? (slice.value / total) * 100 : 0,
	}));
}
